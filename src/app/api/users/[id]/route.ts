import type { NextRequest } from "next/server";
import { getUserById, updateUser, deleteUser } from "@/api/mockUsers";
import { success, failure } from "@/api/response";
import { isValidRole } from "@/api/validation";
import type { UpdateUserInput } from "@/types";

/**
 * Route handlers for a single user resource.
 * The dynamic `[id]` segment is provided via the async `params` object
 * (Next.js 15 made route params a Promise).
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 * Return a single user by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const user = getUserById(id);

  if (!user) {
    return failure(`User with id "${id}" was not found.`, 404);
  }

  return success(user);
}

/**
 * PUT /api/users/[id]
 * Update an existing user with a partial payload.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("Request body must be valid JSON.", 400);
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const update: UpdateUserInput = {};

  if (input.name !== undefined) {
    if (typeof input.name === "string" && input.name.trim()) {
      update.name = input.name.trim();
    } else {
      errors.name = "Name must be a non-empty string.";
    }
  }

  if (input.email !== undefined) {
    if (
      typeof input.email === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
    ) {
      update.email = input.email.trim();
    } else {
      errors.email = "Email must be a valid email address.";
    }
  }

  if (input.role !== undefined) {
    if (isValidRole(input.role)) {
      update.role = input.role;
    } else {
      errors.role = "Role is invalid.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return failure("Validation failed.", 422, errors);
  }

  const updated = updateUser(id, update);
  if (!updated) {
    return failure(`User with id "${id}" was not found.`, 404);
  }

  return success(updated, "User updated successfully.");
}

/**
 * DELETE /api/users/[id]
 * Remove a user by id.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const removed = deleteUser(id);

  if (!removed) {
    return failure(`User with id "${id}" was not found.`, 404);
  }

  return success({ id }, "User deleted successfully.");
}
