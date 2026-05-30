"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
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

  if (!EMAIL_REGEX.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
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

      if (!accessCode) {
        throw new RegistrationError("Invalid access code.");
      }
      if (accessCode.isUsed) {
        throw new RegistrationError("This access code has already been used.");
      }
      if (accessCode.expiresAt && accessCode.expiresAt.getTime() < Date.now()) {
        throw new RegistrationError("This access code has expired.");
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

      const passwordHash = await bcrypt.hash(password, 10);

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
