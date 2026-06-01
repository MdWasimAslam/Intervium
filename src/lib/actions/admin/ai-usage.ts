import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { aiUsageLog, db, users } from "@db";
import { requireAdmin } from "@/lib/session";
import { DAILY_BUDGET, aiCallsUsedToday } from "@/lib/ai-budget";
import {
  IN_USE_MODELS,
  getModelLimits,
  type ModelLimits,
  type ModelRole,
} from "@/lib/ai-limits";

/**
 * Usage for one model the app calls, scoped to the current UTC day, paired with
 * its Groq rate limits. Per-minute fields are live snapshots (calls in the last
 * 60s), NOT a remaining budget. Token sums are a floor: rows where Groq omitted
 * usage counts contribute 0.
 */
export interface ModelUsage {
  model: string;
  role: ModelRole;
  /** Null for an unknown/env-swapped model with no limit reference. */
  limits: ModelLimits | null;
  requestsToday: number;
  tokensToday: number;
  requestsLastMinute: number;
  tokensLastMinute: number;
}

export interface AiUsageStats {
  summary: { today: number; month: number; allTime: number };
  /** Per in-use model: today's consumption vs. Groq's limits. */
  limits: ModelUsage[];
  /** The app's own daily call-budget guard (calls, not tokens). */
  appBudget: { used: number; limit: number };
  byFeature: { feature: string; count: number; totalTokens: number }[];
  byModel: { model: string; count: number; lastUsed: string | null }[];
  /** Null when Groq never returned token counts (section is hidden). */
  tokens: { input: number; output: number; total: number } | null;
  log: {
    id: string;
    createdAt: string;
    email: string | null;
    feature: string;
    model: string;
    totalTokens: number | null;
    status: string;
  }[];
}

const LOG_LIMIT = 50;

/**
 * Aggregate the Groq usage log for the Admin → AI Usage dashboard. Read-only;
 * admin-gated. All heavy lifting is done in SQL so it scales past a handful of
 * rows without pulling the whole table into memory.
 */
export async function getAiUsageStats(): Promise<AiUsageStats> {
  await requireAdmin();

  const now = new Date();
  const dayIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const monthIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
  // Rolling 60s window for the per-minute (RPM/TPM) snapshot gauges.
  const minuteIso = new Date(now.getTime() - 60_000).toISOString();

  const [
    summaryRows,
    perModelRows,
    appUsed,
    byFeature,
    byModel,
    tokenRows,
    log,
  ] = await Promise.all([
    db
      .select({
        today: sql<number>`count(*) filter (where ${aiUsageLog.createdAt} >= ${dayIso}::timestamptz)::int`,
        month: sql<number>`count(*) filter (where ${aiUsageLog.createdAt} >= ${monthIso}::timestamptz)::int`,
        allTime: sql<number>`count(*)::int`,
      })
      .from(aiUsageLog),
    // Per-model: today's requests/tokens (RPD/TPD) + last-60s snapshot (RPM/TPM).
    db
      .select({
        model: aiUsageLog.model,
        requestsToday: sql<number>`count(*) filter (where ${aiUsageLog.createdAt} >= ${dayIso}::timestamptz)::int`,
        tokensToday: sql<number>`coalesce(sum(${aiUsageLog.totalTokens}) filter (where ${aiUsageLog.createdAt} >= ${dayIso}::timestamptz), 0)::int`,
        requestsLastMinute: sql<number>`count(*) filter (where ${aiUsageLog.createdAt} >= ${minuteIso}::timestamptz)::int`,
        tokensLastMinute: sql<number>`coalesce(sum(${aiUsageLog.totalTokens}) filter (where ${aiUsageLog.createdAt} >= ${minuteIso}::timestamptz), 0)::int`,
      })
      .from(aiUsageLog)
      .groupBy(aiUsageLog.model),
    aiCallsUsedToday(),
    db
      .select({
        feature: aiUsageLog.feature,
        count: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${aiUsageLog.totalTokens}), 0)::int`,
      })
      .from(aiUsageLog)
      .groupBy(aiUsageLog.feature),
    db
      .select({
        model: aiUsageLog.model,
        count: sql<number>`count(*)::int`,
        lastUsed: sql<string | null>`max(${aiUsageLog.createdAt})::text`,
      })
      .from(aiUsageLog)
      .groupBy(aiUsageLog.model),
    db
      .select({
        input: sql<number | null>`sum(${aiUsageLog.inputTokens})::int`,
        output: sql<number | null>`sum(${aiUsageLog.outputTokens})::int`,
        total: sql<number | null>`sum(${aiUsageLog.totalTokens})::int`,
      })
      .from(aiUsageLog),
    db
      .select({
        id: aiUsageLog.id,
        createdAt: aiUsageLog.createdAt,
        email: users.email,
        feature: aiUsageLog.feature,
        model: aiUsageLog.model,
        totalTokens: aiUsageLog.totalTokens,
        status: aiUsageLog.status,
      })
      .from(aiUsageLog)
      .leftJoin(users, eq(users.id, aiUsageLog.userId))
      .orderBy(desc(aiUsageLog.createdAt))
      .limit(LOG_LIMIT),
  ]);

  const summary = summaryRows[0] ?? { today: 0, month: 0, allTime: 0 };
  const tok = tokenRows[0];
  const total = tok?.total ?? 0;
  const tokens =
    total && total > 0
      ? { input: tok?.input ?? 0, output: tok?.output ?? 0, total }
      : null;

  // Build one entry per in-use model so each always renders (even at zero
  // usage), merged with its per-model aggregates and Groq limit reference.
  const byModelToday = new Map(perModelRows.map((r) => [r.model, r]));
  const limits: ModelUsage[] = IN_USE_MODELS.map(({ model, role }) => {
    const row = byModelToday.get(model);
    return {
      model,
      role,
      limits: getModelLimits(model),
      requestsToday: row?.requestsToday ?? 0,
      tokensToday: row?.tokensToday ?? 0,
      requestsLastMinute: row?.requestsLastMinute ?? 0,
      tokensLastMinute: row?.tokensLastMinute ?? 0,
    };
  });

  return {
    summary,
    limits,
    appBudget: { used: appUsed, limit: DAILY_BUDGET },
    byFeature: byFeature.sort((a, b) => b.count - a.count),
    byModel: byModel.sort((a, b) => b.count - a.count),
    tokens,
    log: log.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      email: r.email,
      feature: r.feature,
      model: r.model,
      totalTokens: r.totalTokens,
      status: r.status,
    })),
  };
}
