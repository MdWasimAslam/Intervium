/**
 * Shared discriminated result for server actions that return data on success.
 *
 * Use this for actions whose success carries a payload:
 *   `Promise<Result<CvData>>` → `{ ok: true, data } | { ok: false, error }`.
 *
 * For admin mutations that return no data on success, use `AdminResult`
 * (`{ ok: boolean; error?: string }`) from `./admin/util`. Redirect-style
 * actions that only signal failure use `{ error?: string }` locally.
 */
export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: string };
export type Result<T> = Ok<T> | Err;
