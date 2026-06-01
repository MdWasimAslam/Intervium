import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, jobRoles, profiles, techStacks } from "@db";
import { requireAuth } from "@/lib/session";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { toAvatarConfig } from "@/components/ui/avatar-options";
import type {
  RoleOption,
  StackOption,
} from "@/components/onboarding/types";

export const metadata: Metadata = { title: "Profile" };

/**
 * Dedicated profile-edit screen (Server Component).
 *
 * Reads the same `profiles` fields the onboarding wizard writes and hands them
 * to a calm, single-page sectioned editor. Users who haven't finished
 * onboarding are sent there first, mirroring the dashboard guard.
 */
export default async function ProfilePage() {
  const user = await requireAuth();

  const [profile] = await db
    .select({
      displayName: profiles.displayName,
      primaryRole: profiles.primaryRole,
      yearsExperience: profiles.yearsExperience,
      skills: profiles.skills,
      cvText: profiles.cvText,
      avatar: profiles.avatar,
      onboarding: profiles.onboarding,
    })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  const completed =
    (profile?.onboarding as { completed?: boolean } | undefined)?.completed ===
    true;
  if (!profile || !completed) redirect("/onboarding");

  // Reference data — all admin-managed, same sources as onboarding.
  const [roles, stacks] = await Promise.all([
    db
      .select({
        id: jobRoles.id,
        name: jobRoles.name,
        description: jobRoles.description,
      })
      .from(jobRoles)
      .where(eq(jobRoles.isActive, true))
      .orderBy(asc(jobRoles.sortOrder)),
    db
      .select({
        id: techStacks.id,
        jobRoleId: techStacks.jobRoleId,
        name: techStacks.name,
      })
      .from(techStacks)
      .where(eq(techStacks.isActive, true)),
  ]);

  const initial = {
    displayName: profile.displayName ?? "",
    primaryRoleId: profile.primaryRole ?? "",
    yearsExperience: profile.yearsExperience,
    skills: Array.isArray(profile.skills) ? (profile.skills as string[]) : [],
    cvText: profile.cvText ?? "",
    avatar: toAvatarConfig(profile.avatar),
  };

  return (
    <ProfileEditor
      roles={roles as RoleOption[]}
      stacks={stacks as StackOption[]}
      initial={initial}
      seed={user.id}
    />
  );
}
