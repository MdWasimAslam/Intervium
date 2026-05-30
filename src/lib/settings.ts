import { eq } from "drizzle-orm";
import { appSettings, db } from "@db";

export interface AppSettings {
  defaultTimerSeconds: number;
  questionCounts: number[];
  transcriptionProvider: "webspeech" | "whisper";
}

const DEFAULTS: AppSettings = {
  defaultTimerSeconds: 120,
  questionCounts: [3, 5, 10],
  transcriptionProvider: "webspeech",
};

/**
 * Read the global app settings, creating the single row with defaults on
 * first access. Falls back to in-code defaults if the DB is unreachable.
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, "global"));

    if (!row) {
      await db
        .insert(appSettings)
        .values({ id: "global" })
        .onConflictDoNothing();
      return DEFAULTS;
    }

    return {
      defaultTimerSeconds: row.defaultTimerSeconds,
      questionCounts:
        Array.isArray(row.questionCounts) && row.questionCounts.length
          ? row.questionCounts
          : DEFAULTS.questionCounts,
      transcriptionProvider:
        row.transcriptionProvider === "whisper" ? "whisper" : "webspeech",
    };
  } catch (error) {
    console.error("[getSettings]", error);
    return DEFAULTS;
  }
}
