import { success, failure } from "@/api/response";
import { getSession } from "@/lib/session";

/**
 * GET /api/auth/me
 * Return the currently authenticated user, or 401 if not logged in.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return failure("Not authenticated.", 401);
  }
  return success({ username: session.username });
}
