"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  db,
  interviewSessions,
  profiles,
  sessionQuestions,
  users,
} from "@db";
import { withTransaction } from "@db/tx";
import { requireAdmin } from "@/lib/session";
import { isUniqueViolation, zodError, type AdminResult } from "./util";

/* -------------------------------------------------------------------------- */
/* Shared field rules                                                         */
/* -------------------------------------------------------------------------- */

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(255);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200);

const roleSchema = z.enum(["user", "admin"]);

const displayNameSchema = z.string().trim().max(80).optional();
const yearsSchema = z.number().int().min(0).max(60).optional();

/* -------------------------------------------------------------------------- */
/* Activate / deactivate                                                      */
/* -------------------------------------------------------------------------- */

/** Activate or deactivate a user (deactivated users can't log in). */
export async function setUserActive(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), isActive: z.boolean() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid input." };

  if (p.data.id === admin.id && !p.data.isActive) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  await db
    .update(users)
    .set({ isActive: p.data.isActive })
    .where(eq(users.id, p.data.id));
  revalidatePath("/admin/users");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a user directly, bypassing the access-code registration gate.
 *
 * Inserts the account and an accompanying profile row in one transaction so
 * the two never drift apart. The profile is left un-onboarded, so the user is
 * routed through the onboarding wizard on first login (same as a self-signup).
 */
export async function createUser(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z
    .object({
      email: emailSchema,
      password: passwordSchema,
      role: roleSchema,
      displayName: displayNameSchema,
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  try {
    const passwordHash = await bcrypt.hash(p.data.password, 10);
    await withTransaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: p.data.email,
          passwordHash,
          role: p.data.role,
        })
        .returning({ id: users.id });

      await tx.insert(profiles).values({
        userId: user.id,
        displayName: p.data.displayName || p.data.email.split("@")[0],
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    console.error("[createUser]", error);
    return { ok: false, error: "Could not create the user." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Edit core fields + profile                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Update a user's email, role, and basic profile (display name, experience).
 *
 * Email and role live on `users`; display name and years on `profiles`. Both
 * are written in a single transaction. Admins can't strip their own admin role
 * (otherwise they'd lock themselves out of this page).
 */
export async function updateUser(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const p = z
    .object({
      id: z.string().uuid(),
      email: emailSchema,
      role: roleSchema,
      displayName: displayNameSchema,
      yearsExperience: yearsSchema,
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  if (p.data.id === admin.id && p.data.role !== "admin") {
    return { ok: false, error: "You can't remove your own admin role." };
  }

  try {
    await withTransaction(async (tx) => {
      await tx
        .update(users)
        .set({ email: p.data.email, role: p.data.role })
        .where(eq(users.id, p.data.id));

      const profileSet: Partial<typeof profiles.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (p.data.displayName !== undefined) {
        profileSet.displayName = p.data.displayName || null;
      }
      if (p.data.yearsExperience !== undefined) {
        profileSet.yearsExperience = p.data.yearsExperience;
      }

      // Upsert: a profile may not exist yet (legacy/seeded users).
      await tx
        .insert(profiles)
        .values({
          userId: p.data.id,
          displayName: p.data.displayName || null,
          yearsExperience: p.data.yearsExperience ?? 0,
        })
        .onConflictDoUpdate({ target: profiles.userId, set: profileSet });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "That email is already in use." };
    }
    console.error("[updateUser]", error);
    return { ok: false, error: "Could not update the user." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Reset password                                                             */
/* -------------------------------------------------------------------------- */

/** Set a new password for any user (admin-initiated reset). */
export async function changeUserPassword(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), password: passwordSchema })
    .safeParse(input);
  if (!p.success) return { ok: false, error: zodError(p) };

  try {
    const passwordHash = await bcrypt.hash(p.data.password, 10);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, p.data.id));
  } catch (error) {
    console.error("[changeUserPassword]", error);
    return { ok: false, error: "Could not update the password." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Reset account data                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Completely wipe a user's account data while keeping the login intact.
 *
 * Deletes their profile (incl. CV + onboarding) and every interview session
 * with its answers/feedback, returning the account to a fresh, just-registered
 * state. The user, their email, password, role and active flag are untouched —
 * they can still log in and will be sent back through onboarding.
 */
export async function resetUserAccountData(
  input: unknown,
): Promise<AdminResult> {
  await requireAdmin();
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid input." };
  const { id } = p.data;

  // Make sure the target exists so we don't silently no-op on a bad id.
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id));
  if (!target) return { ok: false, error: "User not found." };

  try {
    // Children first: session questions are deleted by their parent sessions.
    await db.delete(sessionQuestions).where(
      inArray(
        sessionQuestions.sessionId,
        db
          .select({ id: interviewSessions.id })
          .from(interviewSessions)
          .where(eq(interviewSessions.userId, id)),
      ),
    );
    await db
      .delete(interviewSessions)
      .where(eq(interviewSessions.userId, id));
    await db.delete(profiles).where(eq(profiles.userId, id));
  } catch (error) {
    console.error("[resetUserAccountData]", error);
    return { ok: false, error: "Could not reset the account." };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
