import type { NextRequest } from "next/server";
import { getAllUsers, createUser } from "@/api/mockUsers";
import { success, failure } from "@/api/response";
import { validateCreateUser } from "@/api/validation";

/**
 * GET /api/users
 * Return the full list of users.
 */
export async function GET() {
  const users = getAllUsers();
  return success(users);
}

/**
 * POST /api/users
 * Create a new user from the JSON request body.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Request body must be valid JSON.", 400);
  }

  const result = validateCreateUser(body);
  if (!result.valid || !result.data) {
    return failure("Validation failed.", 422, result.errors);
  }

  const user = createUser(result.data);
  return success(user, "User created successfully.", 201);
}
