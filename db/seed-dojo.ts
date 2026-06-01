import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Seed the Code Dojo question bank from db/dojo-questions.json.
 *
 * Idempotent: topics and questions are matched by slug, so re-running updates
 * existing content (prompt, tests, topics) without creating duplicates.
 *
 * Run with:  npm run db:seed-dojo
 */

interface QuestionFile {
  topics: { slug: string; name: string; sortOrder?: number }[];
  questions: {
    slug: string;
    title: string;
    difficulty: "easy" | "medium" | "hard";
    topics: string[];
    fnName: string;
    starterCode: string;
    prompt: string;
    testCases: { input: unknown[]; expected: unknown; hidden?: boolean }[];
  }[];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local).");

  const pool = new Pool({
    connectionString: url,
    ssl: /@(localhost|127\.0\.0\.1)/.test(url)
      ? false
      : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });
  const { dojoQuestions, dojoTopics, dojoQuestionTopics } = schema;

  const data: QuestionFile = JSON.parse(
    readFileSync(join(process.cwd(), "db", "dojo-questions.json"), "utf-8"),
  );

  // Topics (upsert by slug).
  for (const t of data.topics) {
    await db
      .insert(dojoTopics)
      .values({ slug: t.slug, name: t.name, sortOrder: t.sortOrder ?? 0 })
      .onConflictDoUpdate({
        target: dojoTopics.slug,
        set: { name: t.name, sortOrder: t.sortOrder ?? 0 },
      });
  }
  const topicRows = await db.select().from(dojoTopics);
  const topicId = new Map(topicRows.map((t) => [t.slug, t.id]));

  // Questions (upsert by slug, then refresh topic links).
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const [existing] = await db
      .select({ id: dojoQuestions.id })
      .from(dojoQuestions)
      .where(eq(dojoQuestions.slug, q.slug));

    let questionId: string;
    const fields = {
      title: q.title,
      prompt: q.prompt,
      difficulty: q.difficulty,
      starterCode: q.starterCode,
      fnName: q.fnName,
      testCases: q.testCases,
      sortOrder: i,
      isActive: true,
    };

    if (existing) {
      await db
        .update(dojoQuestions)
        .set(fields)
        .where(eq(dojoQuestions.id, existing.id));
      questionId = existing.id;
      updated++;
    } else {
      const [row] = await db
        .insert(dojoQuestions)
        .values({ slug: q.slug, ...fields })
        .returning({ id: dojoQuestions.id });
      questionId = row.id;
      inserted++;
    }

    // Rebuild topic links for this question.
    await db
      .delete(dojoQuestionTopics)
      .where(eq(dojoQuestionTopics.questionId, questionId));
    for (const slug of q.topics) {
      const tid = topicId.get(slug);
      if (!tid) {
        console.warn(`  ⚠ unknown topic "${slug}" on ${q.slug} — skipped`);
        continue;
      }
      await db
        .insert(dojoQuestionTopics)
        .values({ questionId, topicId: tid })
        .onConflictDoNothing();
    }
  }

  console.log(
    `Dojo seed complete: ${inserted} inserted, ${updated} updated, ${data.topics.length} topics.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
