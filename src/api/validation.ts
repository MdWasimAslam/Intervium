import { USER_ROLES } from "@/constants";
import type { CreateUserInput, UserRole } from "@/types";

/**
 * Lightweight, dependency-free request validation.
 * For a real app consider a schema library such as Zod.
 */

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Record<string, string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate the body of a "create user" request. */
export function validateCreateUser(
  body: unknown,
): ValidationResult<CreateUserInput> {
  const errors: Record<string, string> = {};
  const input = (body ?? {}) as Record<string, unknown>;

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const role = input.role;

  if (!name) errors.name = "Name is required.";
  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Email is invalid.";
  }
  if (!isValidRole(role)) {
    errors.role = `Role must be one of: ${USER_ROLES.join(", ")}.`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: { name, email, role: role as UserRole },
  };
}

/** Type guard checking that a value is one of the allowed roles. */
export function isValidRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}
