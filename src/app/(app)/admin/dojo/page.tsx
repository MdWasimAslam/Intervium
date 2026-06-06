import { asc, eq, inArray } from "drizzle-orm";
import { db, dojoQuestions, dojoQuestionTopics, dojoTopics } from "@db";
import { requireAdmin } from "@/lib/session";
import { DojoAdmin, type DojoAdminRow } from "@/components/admin/DojoAdmin";
import type { TestCase } from "@/components/code/types";

const PAGE_SIZE = 25;

/** First value of a possibly-array search param, trimmed. */
function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = sp[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
}

export default async function AdminDojoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(pick(sp, "page")) || 1);

  // Paginate the problem bank so the admin table never loads it wholesale.
  const total = await db.$count(dojoQuestions);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const [questions, allTopics] = await Promise.all([
    db
      .select()
      .from(dojoQuestions)
      .orderBy(asc(dojoQuestions.sortOrder), asc(dojoQuestions.title))
      .limit(PAGE_SIZE)
      .offset((safePage - 1) * PAGE_SIZE),
    db
      .select({ name: dojoTopics.name })
      .from(dojoTopics)
      .orderBy(asc(dojoTopics.sortOrder), asc(dojoTopics.name)),
  ]);

  // Topic names per question (for display + edit form), in one query.
  const ids = questions.map((q) => q.id);
  const tagRows = ids.length
    ? await db
        .select({
          questionId: dojoQuestionTopics.questionId,
          name: dojoTopics.name,
        })
        .from(dojoQuestionTopics)
        .innerJoin(dojoTopics, eq(dojoTopics.id, dojoQuestionTopics.topicId))
        .where(inArray(dojoQuestionTopics.questionId, ids))
        .orderBy(asc(dojoTopics.sortOrder))
    : [];

  const topicsByQ = new Map<string, string[]>();
  for (const t of tagRows) {
    const arr = topicsByQ.get(t.questionId) ?? [];
    arr.push(t.name);
    topicsByQ.set(t.questionId, arr);
  }

  const rows: DojoAdminRow[] = questions.map((q) => ({
    id: q.id,
    slug: q.slug,
    title: q.title,
    prompt: q.prompt,
    difficulty: q.difficulty,
    fnName: q.fnName,
    starterCode: q.starterCode,
    testCases: q.testCases as TestCase[],
    isActive: q.isActive,
    topics: topicsByQ.get(q.id) ?? [],
  }));

  return (
    <DojoAdmin
      rows={rows}
      topicSuggestions={allTopics.map((t) => t.name)}
      page={safePage}
      totalPages={totalPages}
      total={total}
    />
  );
}
