import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

/**
 * Helpers for building consistent JSON responses inside route handlers.
 */

/** Build a successful JSON response with the standard envelope. */
export function success<T>(
  data: T,
  message?: string,
  status = 200,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, message }, { status });
}

/** Build an error JSON response with the standard envelope. */
export function failure(
  message: string,
  status = 400,
  errors?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ success: false, message, errors }, { status });
}
