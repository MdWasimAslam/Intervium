import { and, asc, desc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import {
  db,
  difficultyBands,
  focusAreas,
  jobRoles,
  questionsCache,
  techStacks,
} from "@db";
import { requireAdmin } from "@/lib/session";
import { computeSignature } from "@/lib/signature";
import {
  QuestionsAdmin,
  type QuestionFilters,
} from "@/components/admin/QuestionsAdmin";

const PAGE_SIZE = 25;
const INTERVIEW_TYPES = ["technical", "behavioral", "mixed"] as const;
type InterviewType = (typeof INTERVIEW_TYPES)[number];

/** First value of a possibly-array search param, trimmed; "" / "all" → undefined. */
function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = sp[key];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v && v !== "all" ? v : undefined;
}

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // Taxonomy powers both the filter dropdowns and interview-type enumeration.
  const [roles, techs, focuses, bands] = await Promise.all([
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
    db
      .select({
        id: focusAreas.id,
        jobRoleId: focusAreas.jobRoleId,
        name: focusAreas.name,
      })
      .from(focusAreas),
    db
      .select({
        jobRoleId: difficultyBands.jobRoleId,
        label: difficultyBands.label,
      })
      .from(difficultyBands),
  ]);

  // ---- Parse filters from the URL ---------------------------------------
  const roleId = pick(sp, "role");
  const techId = pick(sp, "tech");
  const focusId = pick(sp, "focus");
  const difficulty = pick(sp, "difficulty");
  const interviewType = pick(sp, "type") as InterviewType | undefined;
  const source = pick(sp, "source") as "ai" | "admin" | undefined;
  const active = pick(sp, "active"); // "active" | "inactive" | undefined(all)
  const search = pick(sp, "q");
  const page = Math.max(1, Number(pick(sp, "page")) || 1);

  const filters: QuestionFilters = {
    role: roleId ?? "all",
    tech: techId ?? "all",
    focus: focusId ?? "all",
    difficulty: difficulty ?? "all",
    type: interviewType ?? "all",
    source: source ?? "all",
    active: active ?? "all",
    q: search ?? "",
  };

  // ---- Build the WHERE clause -------------------------------------------
  const conds: SQL[] = [];
  if (roleId) conds.push(eq(questionsCache.jobRoleId, roleId));
  if (techId) conds.push(eq(questionsCache.techStackId, techId));
  if (focusId) conds.push(eq(questionsCache.focusAreaId, focusId));
  if (difficulty) conds.push(eq(questionsCache.difficulty, difficulty));
  if (source) conds.push(eq(questionsCache.source, source));
  if (active === "active") conds.push(eq(questionsCache.isActive, true));
  if (active === "inactive") conds.push(eq(questionsCache.isActive, false));
  if (search) conds.push(ilike(questionsCache.questionText, `%${search}%`));

  // Interview type isn't a column — it's baked into the signature. Enumerate
  // every signature that matches the chosen type (honouring the other active
  // filters) and constrain by that set.
  let impossible = false;
  if (interviewType) {
    const sigs = new Set<string>();
    for (const role of roles) {
      if (roleId && role.id !== roleId) continue;
      const roleTechs = techs.filter(
        (t) => t.jobRoleId === role.id && (!techId || t.id === techId),
      );
      const roleFocuses = focuses.filter(
        (f) => f.jobRoleId === role.id && (!focusId || f.id === focusId),
      );
      const roleLabels = bands
        .filter((b) => b.jobRoleId === role.id)
        .map((b) => b.label)
        .filter((label) => !difficulty || label === difficulty);
      for (const t of roleTechs)
        for (const f of roleFocuses)
          for (const label of roleLabels)
            sigs.add(
              computeSignature({
                jobRoleId: role.id,
                techStackId: t.id,
                focusAreaId: f.id,
                difficulty: label,
                type: interviewType,
              }),
            );
    }
    if (sigs.size === 0) impossible = true;
    else conds.push(inArray(questionsCache.signature, Array.from(sigs)));
  }

  const where = conds.length ? and(...conds) : undefined;

  // ---- Count + current page ---------------------------------------------
  const total = impossible ? 0 : await db.$count(questionsCache, where);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const qs = impossible
    ? []
    : await db
        .select({
          id: questionsCache.id,
          jobRoleId: questionsCache.jobRoleId,
          techStackId: questionsCache.techStackId,
          focusAreaId: questionsCache.focusAreaId,
          roleName: jobRoles.name,
          techName: techStacks.name,
          focusName: focusAreas.name,
          difficulty: questionsCache.difficulty,
          type: questionsCache.type,
          language: questionsCache.language,
          source: questionsCache.source,
          isActive: questionsCache.isActive,
          questionText: questionsCache.questionText,
          idealAnswer: questionsCache.idealAnswer,
        })
        .from(questionsCache)
        .innerJoin(jobRoles, eq(jobRoles.id, questionsCache.jobRoleId))
        .innerJoin(techStacks, eq(techStacks.id, questionsCache.techStackId))
        .innerJoin(focusAreas, eq(focusAreas.id, questionsCache.focusAreaId))
        .where(where)
        .orderBy(desc(questionsCache.createdAt))
        .limit(PAGE_SIZE)
        .offset((safePage - 1) * PAGE_SIZE);

  return (
    <QuestionsAdmin
      roles={roles}
      techStacks={techs}
      focusAreas={focuses}
      bands={bands}
      questions={qs}
      filters={filters}
      total={total}
      page={safePage}
      pageSize={PAGE_SIZE}
      totalPages={totalPages}
    />
  );
}
