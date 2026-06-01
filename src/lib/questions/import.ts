import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
// Import tables from the schema module directly (NOT "@db") so this service has
// no DB-connection side effect at import time — the CLI loader evaluates ESM
// imports before its dotenv config() runs.
import { bankQuestions, jobRoles, techStacks } from "@db/schema";
import type * as schema from "@db/schema";

/**
 * Shared bank-question import service. Backs both the CLI importer
 * (`db/load-questions.ts`) and the admin "Bulk JSON Import" dialog.
 *
 * Resolves role + tech stack BY NAME (case-insensitive), and is idempotent: a
 * question whose normalised text already exists for the same (role, tech) is
 * skipped, so re-importing the same file inserts nothing new.
 */

/** Accepts the app `@db` client or a CLI script's own node-postgres client. */
type Db = NodePgDatabase<typeof schema>;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/* ------------------------------- Schemas --------------------------------- */

export const importQuestionSchema = z.object({
  questionText: z.string().trim().min(1).max(4000),
  idealAnswer: z.string().trim().min(1).max(8000),
});

export const importEntrySchema = z.object({
  role: z.string().trim().min(1),
  techStack: z.string().trim().min(1),
  category: z.enum(["technical", "behavioral"]),
  // How the candidate answers. Defaults to text; coding runs in the editor.
  modality: z.enum(["text", "coding"]).optional(),
  questions: z.array(importQuestionSchema).min(1),
});

export const importFileSchema = z.array(importEntrySchema).min(1);

export type ImportEntry = z.infer<typeof importEntrySchema>;

/* -------------------------------- Report --------------------------------- */

export interface ImportBlockResult {
  index: number;
  label: string;
  status: "ok" | "error" | "empty";
  inserted: number; // would-insert count when dryRun
  duplicates: number;
  error?: string;
}

export interface ImportReport {
  dryRun: boolean;
  totalBlocks: number;
  totalQuestions: number;
  inserted: number; // would-insert total when dryRun
  duplicates: number;
  blocksFailed: number;
  blocks: ImportBlockResult[];
}

/* ------------------------------- Service --------------------------------- */

export async function importQuestions(
  db: Db,
  entries: ImportEntry[],
  opts: { dryRun: boolean },
): Promise<ImportReport> {
  const [roles, techs] = await Promise.all([
    db.select().from(jobRoles),
    db.select().from(techStacks),
  ]);

  // Resolve a name to exactly one row, or describe why it can't.
  function resolveOne<T>(
    matches: T[],
    kind: string,
    name: string,
  ): { row?: T; error?: string } {
    if (matches.length === 0) return { error: `No ${kind} "${name}".` };
    if (matches.length > 1)
      return {
        error: `Ambiguous ${kind} "${name}" — ${matches.length} case-insensitive matches.`,
      };
    return { row: matches[0] };
  }

  // Cache existing question texts per (role, tech) so each pool is read once.
  const poolCache = new Map<string, Set<string>>();
  async function existingTexts(
    roleId: string,
    techStackId: string,
  ): Promise<Set<string>> {
    const key = `${roleId}|${techStackId}`;
    const cached = poolCache.get(key);
    if (cached) return cached;
    const rows = await db
      .select({ questionText: bankQuestions.questionText })
      .from(bankQuestions)
      .where(
        and(
          eq(bankQuestions.roleId, roleId),
          eq(bankQuestions.techStackId, techStackId),
        ),
      );
    const set = new Set(rows.map((r) => norm(r.questionText)));
    poolCache.set(key, set);
    return set;
  }

  const report: ImportReport = {
    dryRun: opts.dryRun,
    totalBlocks: entries.length,
    totalQuestions: entries.reduce((n, e) => n + e.questions.length, 0),
    inserted: 0,
    duplicates: 0,
    blocksFailed: 0,
    blocks: [],
  };

  for (const [i, entry] of entries.entries()) {
    const modality = entry.modality ?? "text";
    const label = `${entry.role} / ${entry.techStack} / ${entry.category} / ${modality}`;

    const fail = (error: string) => {
      report.blocks.push({
        index: i,
        label,
        status: "error",
        inserted: 0,
        duplicates: 0,
        error,
      });
      report.blocksFailed++;
    };

    const roleRes = resolveOne(
      roles.filter(
        (r) =>
          norm(r.name) === norm(entry.role) ||
          norm(r.slug) === norm(entry.role),
      ),
      "role",
      entry.role,
    );
    if (!roleRes.row) {
      fail(roleRes.error!);
      continue;
    }
    const role = roleRes.row;

    const techRes = resolveOne(
      techs.filter(
        (t) =>
          t.jobRoleId === role.id && norm(t.name) === norm(entry.techStack),
      ),
      `tech stack (for role "${role.name}")`,
      entry.techStack,
    );
    if (!techRes.row) {
      fail(techRes.error!);
      continue;
    }
    const tech = techRes.row;

    const seen = await existingTexts(role.id, tech.id);
    let duplicates = 0;
    const fresh = entry.questions.filter((q) => {
      const key = norm(q.questionText);
      if (seen.has(key)) {
        duplicates++;
        return false;
      }
      seen.add(key); // also dedupes repeats within the same file
      return true;
    });
    report.duplicates += duplicates;

    if (fresh.length === 0) {
      report.blocks.push({
        index: i,
        label,
        status: "empty",
        inserted: 0,
        duplicates,
      });
      continue;
    }

    if (!opts.dryRun) {
      await db.insert(bankQuestions).values(
        fresh.map((q) => ({
          roleId: role.id,
          techStackId: tech.id,
          category: entry.category,
          modality,
          questionText: q.questionText,
          idealAnswer: q.idealAnswer,
          isActive: true,
        })),
      );
    }

    report.inserted += fresh.length;
    report.blocks.push({
      index: i,
      label,
      status: "ok",
      inserted: fresh.length,
      duplicates,
    });
  }

  return report;
}
