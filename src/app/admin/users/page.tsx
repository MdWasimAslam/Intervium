import { asc, desc, eq } from "drizzle-orm";
import { db, interviewSessions, jobRoles, profiles, users } from "@db";
import { requireAdmin } from "@/lib/session";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export default async function AdminUsersPage() {
  await requireAdmin();

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      displayName: profiles.displayName,
      yearsExperience: profiles.yearsExperience,
      primaryRole: jobRoles.name,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(jobRoles, eq(jobRoles.id, profiles.primaryRole))
    .orderBy(asc(users.createdAt));

  const sessionRows = await db
    .select({
      id: interviewSessions.id,
      userId: interviewSessions.userId,
      role: jobRoles.name,
      interviewType: interviewSessions.interviewType,
      totalScore: interviewSessions.totalScore,
      maxScore: interviewSessions.maxScore,
      status: interviewSessions.status,
      startedAt: interviewSessions.startedAt,
    })
    .from(interviewSessions)
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .orderBy(desc(interviewSessions.startedAt));

  return (
    <UsersAdmin
      users={userRows}
      sessions={sessionRows.map((s) => ({
        ...s,
        startedAt: s.startedAt.toISOString(),
      }))}
    />
  );
}
