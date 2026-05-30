/**
 * Shared application types.
 */

/** A user record as stored in the database. */
export interface User {
  id: number;
  username: string;
  createdAt: string;
}

/** The decoded JWT payload we keep in the session cookie. */
export interface SessionPayload {
  /** Subject — the user id, as a string (JWT standard). */
  sub: string;
  username: string;
}

/** Standard envelope returned by API route handlers. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
