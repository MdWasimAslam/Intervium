import "server-only";
import { eq } from "drizzle-orm";
import { db, dojoQuestionTopics, dojoTopics } from "@db";

/**
 * Topic helpers shared by the admin and personal question-create paths. Kept in
 * a plain (non-"use server") module so both can import them without dragging in
 * server-action exports or `requireAdmin`.
 */

/** Kebab-case a topic/title into a slug. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Upsert topics by slug and return their ids, in order, de-duped. */
export async function resolveTopicIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    await db
      .insert(dojoTopics)
      .values({ slug, name: name.trim() })
      .onConflictDoUpdate({ target: dojoTopics.slug, set: { name: name.trim() } });
    const [t] = await db
      .select({ id: dojoTopics.id })
      .from(dojoTopics)
      .where(eq(dojoTopics.slug, slug));
    if (t) ids.push(t.id);
  }
  return ids;
}

/** Replace a question's topic links with the given topic ids. */
export async function setQuestionTopics(questionId: string, topicIds: string[]) {
  await db
    .delete(dojoQuestionTopics)
    .where(eq(dojoQuestionTopics.questionId, questionId));
  for (const topicId of topicIds) {
    await db
      .insert(dojoQuestionTopics)
      .values({ questionId, topicId })
      .onConflictDoNothing();
  }
}
