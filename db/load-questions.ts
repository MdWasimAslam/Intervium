import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import {
  importFileSchema,
  importQuestions,
  type ImportEntry,
} from "../src/lib/questions/import";

/**
 * Load HAND-AUTHORED questions into `questions_cache` from a JSON file.
 *
 * Thin CLI wrapper over the shared `importQuestions()` service (which also
 * backs the admin "Import JSON" dialog). Config dimensions are referenced BY
 * NAME (matched case-insensitively) — you never need any UUIDs. The loader is
 * idempotent: a question whose text already exists in the same pool is skipped.
 *
 * File format (db/questions.sample.json shows a full example):
 *
 *   [
 *     {
 *       "role":          "Software Developer",   // jobRoles.name or .slug
 *       "techStack":     "React",                // techStacks.name for that role
 *       "focusArea":     "Frontend",             // focusAreas.name for that role
 *       "difficulty":    "Senior",               // a difficultyBands.label for that role
 *       "interviewType": "technical",            // technical | behavioral | mixed | coding
 *       "modality":      "text",                 // OPTIONAL: text | coding (default per type)
 *       "language":      "typescript",           // OPTIONAL: only for coding modality
 *       "questions": [
 *         { "questionText": "…", "idealAnswer": "…" }
 *       ]
 *     }
 *   ]
 *
 * Run with:   npm run db:load-questions -- --file db/questions.json
 * Validate:   npm run db:load-questions -- --file db/questions.json --dry-run
 */

function strArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FILE = strArg("--file") ?? "db/questions.json";
const DIR = strArg("--dir"); // load + concat every *.json array in this folder
const DRY_RUN = process.argv.includes("--dry-run");

/** Parse one JSON file as an array of config blocks (used by --file and --dir). */
function parseFile(path: string): ImportEntry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read/parse ${path}: ${(error as Error).message}`,
    );
  }
  const parsed = importFileSchema.safeParse(raw);
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
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: /@(localhost|127\.0\.0\.1)/.test(databaseUrl)
      ? false
      : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });

  // 1) Gather config blocks from a single file or a whole directory.
  let entries: ImportEntry[];
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

  // 2) Delegate to the shared import service.
  const report = await importQuestions(db, entries, { dryRun: DRY_RUN });

  console.log(
    `   ${report.totalBlocks} config block(s), ${report.totalQuestions} question(s)`,
  );
  for (const b of report.blocks) {
    if (b.status === "ok") console.log(`   ✓ ${b.label}: +${b.inserted}`);
    else if (b.status === "empty")
      console.log(`   • ${b.label}: nothing new (all duplicates).`);
    else console.error(`   ✗ ${b.label}: ${b.error}`);
  }

  console.log(
    `\n${report.blocksFailed ? "⚠️ " : "✅"} Done. ` +
      `${DRY_RUN ? "would_insert" : "inserted"}=${report.inserted} ` +
      `duplicates_skipped=${report.duplicates} blocks_failed=${report.blocksFailed}`,
  );
  if (DRY_RUN) console.log("   (dry run — nothing was written.)");
  if (report.blocksFailed) process.exit(2);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Load failed:", error);
    process.exit(1);
  });
