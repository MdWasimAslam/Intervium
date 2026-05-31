import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { computeSignature } from "../src/lib/signature";

/**
 * Load HAND-AUTHORED questions into `questions_cache` from a JSON file.
 *
 * This is the companion to `db/seed-questions.ts` (which uses Groq): instead
 * of generating, it ingests questions you wrote yourself. Each row gets the
 * deterministic `signature` computed with the SAME algorithm the interview
 * engine uses, `source = 'admin'`, modality `'text'`, and `is_active = true`.
 *
 * IDEMPOTENT: a question whose text already exists in the same pool
 * (case/whitespace-insensitive) is skipped, so re-running never duplicates.
 *
 * Config dimensions are referenced BY NAME (matched case-insensitively against
 * your taxonomy) — you never need to know any UUIDs.
 *
 * File format (db/questions.sample.json shows a full example):
 *
 *   [
 *     {
 *       "role":          "Software Developer",   // jobRoles.name or .slug
 *       "techStack":     "React",                // techStacks.name for that role
 *       "focusArea":     "Frontend",             // focusAreas.name for that role
 *       "difficulty":    "Senior",               // a difficultyBands.label for that role
 *       "interviewType": "technical",            // technical | behavioral | mixed
 *       "questions": [
 *         { "questionText": "…", "idealAnswer": "…" }
 *       ]
 *     }
 *   ]
 *
 * Run with:   npm run db:load-questions -- --file db/questions.json
 * Validate:   npm run db:load-questions -- --file db/questions.json --dry-run
 */

const entrySchema = z.object({
  role: z.string().trim().min(1),
  techStack: z.string().trim().min(1),
  focusArea: z.string().trim().min(1),
  difficulty: z.string().trim().min(1),
  interviewType: z.enum(["technical", "behavioral", "mixed"]),
  questions: z
    .array(
      z.object({
        questionText: z.string().trim().min(1).max(4000),
        idealAnswer: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1),
});
const fileSchema = z.array(entrySchema).min(1);

function strArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FILE = strArg("--file") ?? "db/questions.json";
const DIR = strArg("--dir"); // load + concat every *.json array in this folder
const DRY_RUN = process.argv.includes("--dry-run");

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Parse one JSON file as an array of config blocks (used by --file and --dir). */
function parseFile(path: string): z.infer<typeof fileSchema> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read/parse ${path}: ${(error as Error).message}`);
  }
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`❌ ${path} failed validation:`);
    for (const issue of parsed.error.issues.slice(0, 20)) {
      console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const db = drizzle(neon(databaseUrl), { schema });

  // 1) Gather config blocks from a single file or a whole directory ------
  let entries: z.infer<typeof fileSchema>;
  let sourceLabel: string;
  if (DIR) {
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();
    if (files.length === 0) throw new Error(`No .json files found in ${DIR}.`);
    entries = files.flatMap((f) => parseFile(join(DIR, f)));
    sourceLabel = `${DIR} (${files.length} file(s))`;
  } else {
    entries = parseFile(FILE);
    sourceLabel = FILE;
  }

  console.log(`📥 Loading ${sourceLabel} ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(
    `   ${entries.length} config block(s), ` +
      `${entries.reduce((n, e) => n + e.questions.length, 0)} question(s)`,
  );

  // 2) Index the taxonomy for name → id resolution -----------------------
  const roles = await db.select().from(schema.jobRoles);
  const techs = await db.select().from(schema.techStacks);
  const focuses = await db.select().from(schema.focusAreas);
  const bands = await db.select().from(schema.difficultyBands);

  const findRole = (name: string) =>
    roles.find(
      (r) => norm(r.name) === norm(name) || norm(r.slug) === norm(name),
    );

  // Cache existing texts per signature so we only query each pool once.
  const poolCache = new Map<string, Set<string>>();
  async function existingTexts(signature: string): Promise<Set<string>> {
    const cached = poolCache.get(signature);
    if (cached) return cached;
    const rows = await db
      .select({ questionText: schema.questionsCache.questionText })
      .from(schema.questionsCache)
      .where(eq(schema.questionsCache.signature, signature));
    const set = new Set(rows.map((r) => norm(r.questionText)));
    poolCache.set(signature, set);
    return set;
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [i, entry] of entries.entries()) {
    const where = `entry #${i + 1} (${entry.role} / ${entry.techStack} / ${entry.focusArea} / ${entry.difficulty} / ${entry.interviewType})`;

    const role = findRole(entry.role);
    if (!role) {
      errors.push(`${where}: unknown role "${entry.role}".`);
      continue;
    }
    const tech = techs.find(
      (t) => t.jobRoleId === role.id && norm(t.name) === norm(entry.techStack),
    );
    const focus = focuses.find(
      (f) => f.jobRoleId === role.id && norm(f.name) === norm(entry.focusArea),
    );
    const band = bands.find(
      (b) => b.jobRoleId === role.id && norm(b.label) === norm(entry.difficulty),
    );
    if (!tech) {
      errors.push(`${where}: no tech stack "${entry.techStack}" for this role.`);
      continue;
    }
    if (!focus) {
      errors.push(`${where}: no focus area "${entry.focusArea}" for this role.`);
      continue;
    }
    if (!band) {
      errors.push(`${where}: no difficulty "${entry.difficulty}" for this role.`);
      continue;
    }

    // Use the canonical band label so the stored difficulty matches the UI.
    const signature = computeSignature({
      jobRoleId: role.id,
      techStackId: tech.id,
      focusAreaId: focus.id,
      difficulty: band.label,
      type: entry.interviewType,
    });
    const seen = await existingTexts(signature);

    const fresh = entry.questions.filter((q) => {
      const key = norm(q.questionText);
      if (seen.has(key)) {
        skipped++;
        return false;
      }
      seen.add(key); // also dedupes within the same file
      return true;
    });

    if (fresh.length === 0) {
      console.log(`   • ${where}: nothing new (all duplicates).`);
      continue;
    }

    if (!DRY_RUN) {
      await db.insert(schema.questionsCache).values(
        fresh.map((q) => ({
          jobRoleId: role.id,
          techStackId: tech.id,
          focusAreaId: focus.id,
          difficulty: band.label,
          type: "text" as const,
          questionText: q.questionText,
          idealAnswer: q.idealAnswer,
          signature,
          source: "admin" as const,
          isActive: true,
        })),
      );
    }
    inserted += fresh.length;
    console.log(`   ✓ ${where}: +${fresh.length}`);
  }

  if (errors.length) {
    console.error("\n⚠️  Skipped blocks:");
    for (const e of errors) console.error(`   • ${e}`);
  }

  console.log(
    `\n${errors.length ? "⚠️ " : "✅"} Done. ` +
      `${DRY_RUN ? "would_insert" : "inserted"}=${inserted} ` +
      `duplicates_skipped=${skipped} blocks_failed=${errors.length}`,
  );
  if (DRY_RUN) console.log("   (dry run — nothing was written.)");
  // Non-zero exit if any block failed, so CI / you notice.
  if (errors.length) process.exit(2);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Load failed:", error);
    process.exit(1);
  });
