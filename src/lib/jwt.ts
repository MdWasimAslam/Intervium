import { SignJWT, jwtVerify } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "@/constants";
import type { SessionPayload } from "@/types";

/**
 * Pure JWT helpers built on `jose`.
 *
 * This module has NO Node-only imports (no bcrypt, no next/headers) so it is
 * safe to use from Edge middleware as well as from server route handlers.
 */

/** Secret key used to sign/verify tokens. Set `AUTH_SECRET` in production. */
function getSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

/** Sign a session payload into a JWT string. */
export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a JWT and return its payload, or `null` if invalid/expired.
 */
export async function verifyToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || typeof payload.username !== "string") return null;
    return { sub: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}
