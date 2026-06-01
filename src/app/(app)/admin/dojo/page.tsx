import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  dojoQuestions,
  dojoQuestionTopics,
  dojoTopics,
} from "@db";
import { requireAdmin } from "@/lib/session";
import { DojoAdmin, type DojoAdminRow } from "@/components/admin/DojoAdmin";
import type { TestCase } from "@/components/code/types";

export default async function AdminDojoPage() {
  await requireAdmin();

  const [questions, allTopics] = await Promise.all([
    db
      .select()
      .from(dojoQuestions)
      .orderBy(asc(dojoQuestions.sortOrder), asc(dojoQuestions.title)),
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
    <DojoAdmin rows={rows} topicSuggestions={allTopics.map((t) => t.name)} />
  );
}
