import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { computeSignature } from "../src/lib/signature";
import {
  DEFAULT_CODING_LANGUAGE,
  generateQuestionBatch,
  QuestionGenerationError,
  type BankGenContext,
  type GeneratedQuestion,
} from "../src/lib/gemini";

/**
 * Deep question-bank seeder.
 *
 * Generates a substantial library of questions into `questions_cache` so the
 * app rarely needs live AI generation during interviews. For EVERY existing
 * job role it walks the full matrix of:
 *
 *     tech stack × focus area × difficulty band × interview type
 *
 * and tops each config up to a target count (default 10). Every row gets the
 * deterministic `signature` computed with the SAME algorithm the interview
 * engine uses (`computeSignature`), `source = 'admin'`, and `is_active = true`.
 *
 * IDEMPOTENT: re-running never duplicates. For each config it reads the
 * existing question texts, generates only the shortfall, and skips anything
 * that matches (case/whitespace-insensitive) a question already in that pool.
 * If a run dies mid-way (e.g. a quota 429), just run it again — it resumes
 * from wherever it left off.
 *
 * Run once with:   npm run db:seed-questions
 *
 * Options (flags or env vars):
 *   --per-config N     target questions per config       (env SEED_PER_CONFIG, default 10)
 *   --delay-ms M       pause between Gemini calls in ms   (env SEED_DELAY_MS,   default 3000)
 *   --batch B          max questions requested per call   (env SEED_BATCH,      default 10)
 *   --role <slug>      restrict to a single job role slug (default: all roles)
 *   --dry-run          plan only — no Gemini calls, no writes
 *
 * Requires GEMINI_API_KEY (unless --dry-run) and DATABASE_URL.
 */

const INTERVIEW_TYPES = [
  "technical",
  "behavioral",
  "mixed",
  "coding",
] as const;
type InterviewType = (typeof INTERVIEW_TYPES)[number];

/** Read a numeric CLI flag (`--name V`) falling back to an env var, then a default. */
function numArg(flag: string, env: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  const raw = i >= 0 ? process.argv[i + 1] : process.env[env];
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function strArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const PER_CONFIG = numArg("--per-config", "SEED_PER_CONFIG", 10);
const DELAY_MS = numArg("--delay-ms", "SEED_DELAY_MS", 3000);
const BATCH = Math.min(numArg("--batch", "SEED_BATCH", 10), 25);
const ROLE_SLUG = strArg("--role");
const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Normalise question text for duplicate detection. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Call Gemini with exponential backoff so transient quota/network errors don't abort the run. */
async function generateWithRetry(
  ctx: BankGenContext,
  configLabel: string,
): Promise<GeneratedQuestion[]> {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await generateQuestionBatch(ctx);
    } catch (error) {
      if (!(error instanceof QuestionGenerationError)) throw error;
      if (attempt === MAX_ATTEMPTS) {
        console.warn(
          `   ⚠️  ${configLabel}: giving up after ${MAX_ATTEMPTS} attempts — re-run to resume.`,
        );
        return [];
      }
      const backoff = DELAY_MS * 2 ** attempt;
      console.warn(
        `   ⏳ ${configLabel}: generation failed (attempt ${attempt}), backing off ${Math.round(backoff / 1000)}s…`,
      );
      await sleep(backoff);
    }
  }
  return [];
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  if (!DRY_RUN && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set (use --dry-run to plan without it).");
  }

  const db = drizzle(neon(databaseUrl), { schema });

  console.log("🌱 Question-bank seeder");
  console.log(
    `   per-config=${PER_CONFIG}  batch=${BATCH}  delay=${DELAY_MS}ms  ` +
      `role=${ROLE_SLUG ?? "all"}  ${DRY_RUN ? "(DRY RUN)" : ""}`,
  );

  // 1) Roles in scope ----------------------------------------------------
  const allRoles = await db.select().from(schema.jobRoles);
  const roles = ROLE_SLUG
    ? allRoles.filter((r) => r.slug === ROLE_SLUG)
    : allRoles;
  if (roles.length === 0) {
    throw new Error(
      ROLE_SLUG
        ? `No job role with slug "${ROLE_SLUG}".`
        : "No job roles found. Run `npm run db:seed` first.",
    );
  }

  let totalInserted = 0;
  let totalCalls = 0;
  let configsTouched = 0;
  let configsTotal = 0;

  for (const role of roles) {
    // Only active taxonomy contributes to interviews, so only seed that.
    const [techs, focuses, bands] = await Promise.all([
      db
        .select()
        .from(schema.techStacks)
        .where(
          and(
            eq(schema.techStacks.jobRoleId, role.id),
            eq(schema.techStacks.isActive, true),
          ),
        ),
      db
        .select()
        .from(schema.focusAreas)
        .where(
          and(
            eq(schema.focusAreas.jobRoleId, role.id),
            eq(schema.focusAreas.isActive, true),
          ),
        ),
      db
        .select()
        .from(schema.difficultyBands)
        .where(eq(schema.difficultyBands.jobRoleId, role.id)),
    ]);

    if (!techs.length || !focuses.length || !bands.length) {
      console.log(
        `\n💼 ${role.name}: skipped (needs tech stacks, focus areas, and difficulty bands).`,
      );
      continue;
    }

    const roleConfigs =
      techs.length * focuses.length * bands.length * INTERVIEW_TYPES.length;
    configsTotal += roleConfigs;
    console.log(
      `\n💼 ${role.name}: ${roleConfigs} configs ` +
        `(${techs.length} tech × ${focuses.length} focus × ${bands.length} bands × ${INTERVIEW_TYPES.length} types)` +
        ` → target ≥ ${roleConfigs * PER_CONFIG} questions`,
    );

    let roleInserted = 0;

    for (const tech of techs) {
      for (const focus of focuses) {
        for (const band of bands) {
          for (const type of INTERVIEW_TYPES) {
            const signature = computeSignature({
              jobRoleId: role.id,
              techStackId: tech.id,
              focusAreaId: focus.id,
              difficulty: band.label,
              type,
            });

            // Existing pool for this exact config (any source / active state).
            const existing = await db
              .select({ questionText: schema.questionsCache.questionText })
              .from(schema.questionsCache)
              .where(eq(schema.questionsCache.signature, signature));

            const seen = new Set(existing.map((e) => norm(e.questionText)));
            const shortfall = PER_CONFIG - existing.length;
            const label = `${tech.name}/${focus.name}/${band.label}/${type}`;

            if (shortfall <= 0) continue;
            configsTouched++;

            if (DRY_RUN) {
              console.log(`   • ${label}: need ${shortfall} more`);
              roleInserted += shortfall;
              continue;
            }

            // Generate (in batches) until the config reaches PER_CONFIG.
            let added = 0;
            while (added < shortfall) {
              const want = Math.min(BATCH, shortfall - added);
              const ctx: BankGenContext = {
                roleName: role.name,
                techStack: tech.name,
                focusArea: focus.name,
                difficulty: band.label,
                interviewType: type,
                count: want,
                avoid: Array.from(seen).slice(0, 60),
              };

              const generated = await generateWithRetry(ctx, label);
              totalCalls++;

              const fresh = generated.filter((g) => {
                const key = norm(g.question_text);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });

              if (fresh.length === 0) {
                // Nothing new (all dupes or a failed call) — stop topping up this
                // config to avoid an infinite loop; a later re-run can retry.
                if (generated.length === 0) {
                  await sleep(DELAY_MS);
                }
                break;
              }

              const take = fresh.slice(0, shortfall - added);
              const isCoding = type === "coding";
              await db.insert(schema.questionsCache).values(
                take.map((g) => ({
                  jobRoleId: role.id,
                  techStackId: tech.id,
                  focusAreaId: focus.id,
                  difficulty: band.label,
                  type: isCoding ? ("coding" as const) : ("either" as const),
                  language: isCoding
                    ? (g.language ?? DEFAULT_CODING_LANGUAGE)
                    : null,
                  questionText: g.question_text,
                  idealAnswer: g.ideal_answer,
                  signature,
                  source: "admin" as const,
                  isActive: true,
                })),
              );

              added += take.length;
              roleInserted += take.length;
              totalInserted += take.length;

              // Rate-limit-friendly pacing between Gemini calls.
              await sleep(DELAY_MS);
            }

            console.log(`   ✓ ${label}: +${added} (pool now ~${existing.length + added})`);
          }
        }
      }
    }

    console.log(`   ${role.name}: ${roleInserted} ${DRY_RUN ? "needed" : "inserted"}.`);
  }

  console.log(
    `\n✅ Done. configs=${configsTotal} touched=${configsTouched} ` +
      `gemini_calls=${totalCalls} ${DRY_RUN ? "would_insert" : "inserted"}=${totalInserted}`,
  );
  if (DRY_RUN) console.log("   (dry run — no questions were written.)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
