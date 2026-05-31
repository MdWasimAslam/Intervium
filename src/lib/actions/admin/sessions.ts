"use server";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, interviewSessions, jobRoles } from "@db";
import { requireAdmin } from "@/lib/session";

/** One interview session, shaped for the admin user-history dialog. */
export interface AdminUserSession {
  id: string;
  role: string;
  interviewType: string;
  totalScore: number;
  maxScore: number;
  status: string;
  startedAt: string;
}

/** Cap on how many sessions the history dialog loads per user. */
const SESSION_LIMIT = 50;

/**
 * Load a single user's most recent interview sessions, newest first. Admin-only
 * and bounded — replaces the old platform-wide eager load on the users page,
 * which fetched every session for every user. Called lazily when the per-user
 * history dialog opens.
 */
export async function getUserSessions(
  userId: string,
): Promise<AdminUserSession[]> {
  await requireAdmin();

  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return [];

  const rows = await db
    .select({
      id: interviewSessions.id,
      role: jobRoles.name,
      interviewType: interviewSessions.interviewType,
      totalScore: interviewSessions.totalScore,
      maxScore: interviewSessions.maxScore,
      status: interviewSessions.status,
      startedAt: interviewSessions.startedAt,
    })
    .from(interviewSessions)
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .where(eq(interviewSessions.userId, parsed.data))
    .orderBy(desc(interviewSessions.startedAt))
    .limit(SESSION_LIMIT);

  return rows.map((s) => ({ ...s, startedAt: s.startedAt.toISOString() }));
}
