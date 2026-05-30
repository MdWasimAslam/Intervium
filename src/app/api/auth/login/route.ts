import type { NextRequest } from "next/server";
import { success, failure } from "@/api/response";
import { verifyCredentials } from "@/lib/seed";
import { createSession } from "@/lib/session";

/**
 * POST /api/auth/login
 * Validate username/password against the database and, on success,
 * issue a JWT stored in an httpOnly cookie.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Request body must be valid JSON.", 400);
  }

  const { username, password } = (body ?? {}) as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return failure("Username and password are required.", 422);
  }

  try {
    const user = await verifyCredentials(username, password);
    if (!user) {
      return failure("Invalid username or password.", 401);
    }

    await createSession({ sub: String(user.id), username: user.username });
    return success({ username: user.username }, "Logged in successfully.");
  } catch (error) {
    console.error("[auth/login]", error);
    return failure("Something went wrong while logging in.", 500);
  }
}
