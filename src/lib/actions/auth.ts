"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { allowAction } from "@/lib/rate-limit";
import { withTransaction } from "@db/tx";
import { accessCodes, profiles, users } from "@db";

export interface AuthFormState {
  error?: string;
}

/** Thrown inside the registration transaction to surface a user-facing message. */
class RegistrationError extends Error {}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user behind the access-code gate.
 *
 * The entire check-and-claim runs in a single DB transaction with a
 * `SELECT … FOR UPDATE` row lock on the access code, so a code can never be
 * consumed twice — even under concurrent requests.
 */
export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  // Throttle by email to blunt automated registration / code-enumeration abuse.
  if (!allowAction(`register:${email}`, 5, 60_000)) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  // bcrypt truncates at 72 bytes; reject longer to avoid silent truncation.
  if (password.length > 72) {
    return { error: "Password must be at most 72 characters." };
  }
  if (!code) {
    return { error: "An access code is required." };
  }

  try {
    await withTransaction(async (tx) => {
      // Lock the access-code row for the duration of the transaction.
      const [accessCode] = await tx
        .select()
        .from(accessCodes)
        .where(eq(accessCodes.code, code))
        .for("update");

      // Unified message across missing / used / expired so the response leaks
      // no signal that helps an attacker enumerate valid codes.
      const codeUnavailable = "Invalid or unavailable access code.";
      if (!accessCode) {
        throw new RegistrationError(codeUnavailable);
      }
      if (accessCode.isUsed) {
        throw new RegistrationError(codeUnavailable);
      }
      if (accessCode.expiresAt && accessCode.expiresAt.getTime() < Date.now()) {
        throw new RegistrationError(codeUnavailable);
      }

      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (existing) {
        throw new RegistrationError(
          "An account with this email already exists.",
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [user] = await tx
        .insert(users)
        .values({ email, passwordHash, role: "user" })
        .returning({ id: users.id });

      await tx
        .insert(profiles)
        .values({ userId: user.id, displayName: email.split("@")[0] });

      await tx
        .update(accessCodes)
        .set({ isUsed: true, usedBy: user.id })
        .where(eq(accessCodes.id, accessCode.id));
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return { error: error.message };
    }
    console.error("[register]", error);
    return { error: "Something went wrong. Please try again." };
  }

  // Sign the new user in and head to onboarding. signIn throws a redirect
  // on success, which must propagate out of the action.
  try {
    await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please log in." };
    }
    throw error;
  }

  return {};
}

/**
 * Authenticate with email + password via the Credentials provider.
 */
export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Throttle by email to slow credential-stuffing / brute-force attempts.
  if (!allowAction(`login:${email}`, 5, 60_000)) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  return {};
}
