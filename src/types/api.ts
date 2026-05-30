/**
 * Standard shape returned by every API route handler.
 * Using a consistent envelope keeps client-side parsing predictable.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Standard shape returned when an API route handler fails.
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  /** Optional field-level validation errors, keyed by field name. */
  errors?: Record<string, string>;
}
