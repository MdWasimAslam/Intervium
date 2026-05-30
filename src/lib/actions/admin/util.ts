/** Standard result for admin mutating actions. */
export interface AdminResult {
  ok: boolean;
  error?: string;
}

/** First zod issue message, or a generic fallback. */
export function zodError(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}): string {
  if (result.success || !result.error) return "Invalid input.";
  return result.error.issues[0]?.message ?? "Invalid input.";
}

/** Detect a Postgres unique-constraint violation from a thrown error. */
export function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("duplicate key") || message.includes("23505");
}
