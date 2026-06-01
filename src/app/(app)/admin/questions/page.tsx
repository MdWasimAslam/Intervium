import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import { bankQuestions, db, jobRoles, techStacks } from "@db";
import { requireAdmin } from "@/lib/session";
import {
  QuestionsAdmin,
  type QuestionFilters,
} from "@/components/admin/QuestionsAdmin";

const PAGE_SIZE = 25;
const CATEGORIES = ["technical", "behavioral"] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First value of a possibly-array search param, trimmed; "" / "all" → undefined. */
function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = sp[key];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v && v !== "all" ? v : undefined;
}

/** Validated enum pick — out-of-range values behave like "no filter". */
function pickEnum<T extends string>(
  sp: Record<string, string | string[] | undefined>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const v = pick(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Validated UUID pick — a non-UUID would raise a DB error, so drop it. */
function pickUuid(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = pick(sp, key);
  return v && UUID_RE.test(v) ? v : undefined;
}

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // Taxonomy powers the filter dropdowns + the Add/Edit pickers.
  const [roles, techs] = await Promise.all([
    db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .orderBy(asc(jobRoles.sortOrder)),
    db
      .select({
        id: techStacks.id,
        jobRoleId: techStacks.jobRoleId,
        name: techStacks.name,
      })
      .from(techStacks),
  ]);

  // ---- Parse filters from the URL ---------------------------------------
  const roleId = pickUuid(sp, "role");
  const techId = pickUuid(sp, "tech");
  const category = pickEnum(sp, "category", CATEGORIES);
  const search = pick(sp, "q");
  const page = Math.max(1, Number(pick(sp, "page")) || 1);

  const filters: QuestionFilters = {
    role: roleId ?? "all",
    tech: techId ?? "all",
    category: category ?? "all",
    q: search ?? "",
  };

  // ---- WHERE — every filter is a direct, indexed column comparison -------
  const conds: SQL[] = [];
  if (roleId) conds.push(eq(bankQuestions.roleId, roleId));
  if (techId) conds.push(eq(bankQuestions.techStackId, techId));
  if (category) conds.push(eq(bankQuestions.category, category));
  if (search) conds.push(ilike(bankQuestions.questionText, `%${search}%`));
  const where = conds.length ? and(...conds) : undefined;

  const total = await db.$count(bankQuestions, where);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const questions = await db
    .select({
      id: bankQuestions.id,
      roleId: bankQuestions.roleId,
      techStackId: bankQuestions.techStackId,
      roleName: jobRoles.name,
      techName: techStacks.name,
      category: bankQuestions.category,
      modality: bankQuestions.modality,
      isActive: bankQuestions.isActive,
      questionText: bankQuestions.questionText,
      idealAnswer: bankQuestions.idealAnswer,
    })
    .from(bankQuestions)
    .innerJoin(jobRoles, eq(jobRoles.id, bankQuestions.roleId))
    .innerJoin(techStacks, eq(techStacks.id, bankQuestions.techStackId))
    .where(where)
    .orderBy(desc(bankQuestions.createdAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  return (
    <QuestionsAdmin
      roles={roles}
      techStacks={techs}
      questions={questions}
      filters={filters}
      total={total}
      page={safePage}
      pageSize={PAGE_SIZE}
      totalPages={totalPages}
    />
  );
}
