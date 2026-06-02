import "server-only";
import { z } from "zod";
import { db, dojoQuestions } from "@db";
import { resolveTopicIds, setQuestionTopics } from "@/lib/dojo/topics";
import { isUniqueViolation } from "@/lib/actions/admin/util";

/**
 * Admin bulk-import service for built-in Code Dojo problems. Backs the admin
 * "Bulk JSON import" dialog. Each problem carries an explicit slug (like the
 * single create form); a problem whose slug already exists is skipped, so
 * re-importing the same file inserts nothing new. Supports a dry run that
 * validates + reports without writing.
 */

const testCaseSchema = z.object({
  input: z.array(z.unknown()),
  expected: z.unknown(),
  hidden: z.boolean().optional(),
});

/** One built-in problem in an import file. Mirrors the admin create form. */
export const importDojoQuestionSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(120)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug: lowercase letters, numbers and hyphens only.",
    ),
  title: z.string().trim().min(1, "Title is required.").max(200),
  prompt: z.string().trim().min(1, "Prompt is required.").max(8000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  fnName: z
    .string()
    .trim()
    .min(1, "Function name is required.")
    .max(80)
    .regex(
      /^[A-Za-z_$][A-Za-z0-9_$]*$/,
      "Function name must be a valid identifier.",
    ),
  starterCode: z.string().min(1, "Starter code is required.").max(20000),
  testCases: z.array(testCaseSchema).min(1, "Add at least one test case."),
  // Topic NAMES (existing or new); resolved to topic rows by slug.
  topics: z.array(z.string().trim().min(1)).max(12).default([]),
});

export const importDojoFileSchema = z
  .array(importDojoQuestionSchema)
  .min(1)
  .max(100);

export type ImportDojoQuestion = z.infer<typeof importDojoQuestionSchema>;

export interface DojoImportItemResult {
  index: number;
  label: string;
  status: "ok" | "duplicate" | "error";
  error?: string;
}

export interface DojoImportReport {
  dryRun: boolean;
  total: number;
  inserted: number; // would-insert count when dryRun
  duplicates: number;
  failed: number;
  items: DojoImportItemResult[];
}

export async function importDojoQuestions(
  entries: ImportDojoQuestion[],
  opts: { dryRun: boolean },
): Promise<DojoImportReport> {
  const existing = await db
    .select({ slug: dojoQuestions.slug })
    .from(dojoQuestions);
  const seen = new Set(existing.map((r) => r.slug));

  const report: DojoImportReport = {
    dryRun: opts.dryRun,
    total: entries.length,
    inserted: 0,
    duplicates: 0,
    failed: 0,
    items: [],
  };

  for (const [i, q] of entries.entries()) {
    const label = `${q.title} (${q.slug})`;

    // Skip slugs that already exist — also dedupes repeats within the same file.
    if (seen.has(q.slug)) {
      report.duplicates++;
      report.items.push({ index: i, label, status: "duplicate" });
      continue;
    }
    seen.add(q.slug);

    if (opts.dryRun) {
      report.inserted++;
      report.items.push({ index: i, label, status: "ok" });
      continue;
    }

    try {
      const [row] = await db
        .insert(dojoQuestions)
        .values({
          slug: q.slug,
          title: q.title,
          prompt: q.prompt,
          difficulty: q.difficulty,
          fnName: q.fnName,
          starterCode: q.starterCode,
          testCases: q.testCases,
          isActive: true,
        })
        .returning({ id: dojoQuestions.id });
      await setQuestionTopics(row.id, await resolveTopicIds(q.topics));
      report.inserted++;
      report.items.push({ index: i, label, status: "ok" });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a race on the slug — treat as a skipped duplicate.
        report.duplicates++;
        report.items.push({ index: i, label, status: "duplicate" });
      } else {
        console.error("[importDojoQuestions]", error);
        report.failed++;
        report.items.push({
          index: i,
          label,
          status: "error",
          error: "Could not insert.",
        });
      }
    }
  }

  return report;
}
