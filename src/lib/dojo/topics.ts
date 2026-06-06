import "server-only";
import { eq, sql } from "drizzle-orm";
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
  // De-dupe by slug up front, preserving first-seen order.
  const seen = new Set<string>();
  const rows: { slug: string; name: string }[] = [];
  for (const name of names) {
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    rows.push({ slug, name: name.trim() });
  }
  if (rows.length === 0) return [];

  // Single batched upsert with RETURNING instead of 2 round trips per topic.
  // RETURNING order isn't guaranteed, so map ids back onto our input order.
  const upserted = await db
    .insert(dojoTopics)
    .values(rows)
    .onConflictDoUpdate({
      target: dojoTopics.slug,
      set: { name: sql`excluded.name` },
    })
    .returning({ id: dojoTopics.id, slug: dojoTopics.slug });

  const idBySlug = new Map(upserted.map((t) => [t.slug, t.id]));
  return rows
    .map((r) => idBySlug.get(r.slug))
    .filter((id): id is string => Boolean(id));
}

/** Replace a question's topic links with the given topic ids. */
export async function setQuestionTopics(
  questionId: string,
  topicIds: string[],
) {
  await db
    .delete(dojoQuestionTopics)
    .where(eq(dojoQuestionTopics.questionId, questionId));

  const unique = [...new Set(topicIds)];
  if (unique.length === 0) return;

  // Single batched insert instead of one round trip per topic id.
  await db
    .insert(dojoQuestionTopics)
    .values(unique.map((topicId) => ({ questionId, topicId })))
    .onConflictDoNothing();
}
