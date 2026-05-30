import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { computeSignature } from "../src/lib/signature";

/**
 * Curated coding questions (one per difficulty band) for the Software
 * Developer role. Seeded so a "Coding" interview works out of the box without
 * running the AI bank seeder. Each carries a problem prompt and a complete
 * reference solution (reused as ideal_answer).
 */
const CODING_QUESTIONS: {
  difficulty: string;
  language: string;
  questionText: string;
  idealAnswer: string;
}[] = [
  {
    difficulty: "Junior",
    language: "javascript",
    questionText:
      "Write a function `sumEven(nums)` that returns the sum of all even numbers in an array of integers. Example: sumEven([1, 2, 3, 4]) === 6. Return 0 for an empty array.",
    idealAnswer:
      "function sumEven(nums) {\n  return nums.reduce((sum, n) => (n % 2 === 0 ? sum + n : sum), 0);\n}\n// O(n) time, O(1) space — one pass, accumulating only even values.",
  },
  {
    difficulty: "Mid",
    language: "javascript",
    questionText:
      "Implement `firstNonRepeating(str)` that returns the first character that appears exactly once in the string, or null if there is none. Example: firstNonRepeating('aabbc') === 'c'.",
    idealAnswer:
      "function firstNonRepeating(str) {\n  const counts = new Map();\n  for (const ch of str) counts.set(ch, (counts.get(ch) ?? 0) + 1);\n  for (const ch of str) if (counts.get(ch) === 1) return ch;\n  return null;\n}\n// O(n) time, O(k) space (k = distinct chars). Two passes: count, then scan in order.",
  },
  {
    difficulty: "Senior",
    language: "typescript",
    questionText:
      "Write `groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]>` that groups array items by the string key returned by `key`. Preserve input order within each group.",
    idealAnswer:
      "function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {\n  const out: Record<string, T[]> = {};\n  for (const item of items) {\n    const k = key(item);\n    (out[k] ??= []).push(item);\n  }\n  return out;\n}\n// O(n) time, O(n) space. A single pass; `??=` lazily creates each bucket.",
  },
  {
    difficulty: "Lead",
    language: "typescript",
    questionText:
      "Implement an LRU cache class `LRUCache<K, V>` with `get(key): V | undefined` and `put(key, value): void`, both O(1) on average, evicting the least-recently-used entry when capacity is exceeded.",
    idealAnswer:
      "class LRUCache<K, V> {\n  private map = new Map<K, V>();\n  constructor(private capacity: number) {}\n  get(key: K): V | undefined {\n    if (!this.map.has(key)) return undefined;\n    const value = this.map.get(key)!;\n    this.map.delete(key);\n    this.map.set(key, value); // re-insert → most recent\n    return value;\n  }\n  put(key: K, value: V): void {\n    if (this.map.has(key)) this.map.delete(key);\n    this.map.set(key, value);\n    if (this.map.size > this.capacity) {\n      this.map.delete(this.map.keys().next().value); // oldest key\n    }\n  }\n}\n// Map preserves insertion order, so the first key is always the LRU entry. O(1) get/put.",
  },
];

/**
 * Seed the database with baseline data.
 * Idempotent: existing rows are left in place, so it is safe to re-run.
 * Run with: npm run db:seed
 */

const ADMIN_EMAIL = "admin@intervium.app";
const ADMIN_PASSWORD = "Intervium@Admin1"; // placeholder — change after first login

const ACCESS_CODES = ["INTV-2K7Q4", "INTV-9F3X1", "INTV-5M8Z6"];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const db = drizzle(neon(databaseUrl), { schema });

  // 1) Admin user --------------------------------------------------------
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await db
    .insert(schema.users)
    .values({ email: ADMIN_EMAIL, passwordHash, role: "admin" })
    .onConflictDoNothing({ target: schema.users.email });

  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_EMAIL));

  console.log("\n👤 Admin user:");
  console.log(`   email:    ${admin.email}`);
  console.log(`   password: ${ADMIN_PASSWORD}  (placeholder plaintext)`);
  console.log(`   hash:     ${admin.passwordHash}`);

  // 2) Job role ----------------------------------------------------------
  await db
    .insert(schema.jobRoles)
    .values({
      name: "Software Developer",
      slug: "software-developer",
      description: "Builds and maintains software applications.",
      sortOrder: 1,
    })
    .onConflictDoNothing({ target: schema.jobRoles.slug });

  const [jobRole] = await db
    .select()
    .from(schema.jobRoles)
    .where(eq(schema.jobRoles.slug, "software-developer"));

  // 3) Focus areas -------------------------------------------------------
  const existingFocus = await db
    .select()
    .from(schema.focusAreas)
    .where(eq(schema.focusAreas.jobRoleId, jobRole.id));

  if (existingFocus.length === 0) {
    await db.insert(schema.focusAreas).values(
      ["General", "Frontend", "Backend"].map((name) => ({
        jobRoleId: jobRole.id,
        name,
      })),
    );
  }

  // 4) Tech stacks -------------------------------------------------------
  const existingStacks = await db
    .select()
    .from(schema.techStacks)
    .where(eq(schema.techStacks.jobRoleId, jobRole.id));

  if (existingStacks.length === 0) {
    await db.insert(schema.techStacks).values(
      ["React", "React Native", "Node.js", "MongoDB"].map((name) => ({
        jobRoleId: jobRole.id,
        name,
      })),
    );
  }

  // 5) Difficulty bands --------------------------------------------------
  const existingBands = await db
    .select()
    .from(schema.difficultyBands)
    .where(eq(schema.difficultyBands.jobRoleId, jobRole.id));

  if (existingBands.length === 0) {
    await db.insert(schema.difficultyBands).values([
      { jobRoleId: jobRole.id, label: "Junior", minYears: 0, maxYears: 1 },
      { jobRoleId: jobRole.id, label: "Mid", minYears: 2, maxYears: 4 },
      { jobRoleId: jobRole.id, label: "Senior", minYears: 5, maxYears: 8 },
      { jobRoleId: jobRole.id, label: "Lead", minYears: 9, maxYears: 99 },
    ]);
  }

  // 5b) Curated coding questions ----------------------------------------
  // Attached to the General focus + Node.js stack for the "coding" pool.
  const [codingFocus] = await db
    .select()
    .from(schema.focusAreas)
    .where(
      and(
        eq(schema.focusAreas.jobRoleId, jobRole.id),
        eq(schema.focusAreas.name, "General"),
      ),
    );
  const [codingStack] = await db
    .select()
    .from(schema.techStacks)
    .where(
      and(
        eq(schema.techStacks.jobRoleId, jobRole.id),
        eq(schema.techStacks.name, "Node.js"),
      ),
    );

  if (codingFocus && codingStack) {
    let codingInserted = 0;
    for (const q of CODING_QUESTIONS) {
      const signature = computeSignature({
        jobRoleId: jobRole.id,
        techStackId: codingStack.id,
        focusAreaId: codingFocus.id,
        difficulty: q.difficulty,
        type: "coding",
      });

      // Idempotent: skip if this exact prompt already exists in the pool.
      const [exists] = await db
        .select({ id: schema.questionsCache.id })
        .from(schema.questionsCache)
        .where(
          and(
            eq(schema.questionsCache.signature, signature),
            eq(schema.questionsCache.questionText, q.questionText),
          ),
        );
      if (exists) continue;

      await db.insert(schema.questionsCache).values({
        jobRoleId: jobRole.id,
        techStackId: codingStack.id,
        focusAreaId: codingFocus.id,
        difficulty: q.difficulty,
        type: "coding",
        language: q.language,
        questionText: q.questionText,
        idealAnswer: q.idealAnswer,
        signature,
        source: "admin",
        isActive: true,
      });
      codingInserted++;
    }
    if (codingInserted > 0) {
      console.log(`\n💻 Seeded ${codingInserted} coding question(s).`);
    }
  }

  // 6) Access codes ------------------------------------------------------
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db
    .insert(schema.accessCodes)
    .values(
      ACCESS_CODES.map((code) => ({
        code,
        createdBy: admin.id,
        expiresAt,
      })),
    )
    .onConflictDoNothing({ target: schema.accessCodes.code });

  // 7) Report ------------------------------------------------------------
  await report(db);
  console.log("\n✅ Seed complete.");
}

async function report(db: ReturnType<typeof drizzle<typeof schema>>) {
  const jobRoleRows = await db.select().from(schema.jobRoles);
  const focusRows = await db.select().from(schema.focusAreas);
  const stackRows = await db.select().from(schema.techStacks);
  const bandRows = await db.select().from(schema.difficultyBands);
  const codeRows = await db.select().from(schema.accessCodes);

  console.log("\n💼 job_roles:");
  console.table(
    jobRoleRows.map((r) => ({ name: r.name, slug: r.slug, sortOrder: r.sortOrder })),
  );
  console.log("🎯 focus_areas:");
  console.table(focusRows.map((r) => ({ name: r.name, isActive: r.isActive })));
  console.log("🧰 tech_stacks:");
  console.table(stackRows.map((r) => ({ name: r.name, isActive: r.isActive })));
  console.log("📊 difficulty_bands:");
  console.table(
    bandRows.map((r) => ({
      label: r.label,
      minYears: r.minYears,
      maxYears: r.maxYears,
    })),
  );
  console.log("🔑 access_codes:");
  console.table(
    codeRows.map((r) => ({
      code: r.code,
      isUsed: r.isUsed,
      expiresAt: r.expiresAt?.toISOString().slice(0, 10) ?? null,
    })),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
