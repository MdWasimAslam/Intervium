/**
 * Shared types for the in-browser JS editor + runner. Used by Code Dojo today
 * and (Phase 3) the interview coding flow. Kept dependency-free so the worker
 * can import them as erased types.
 */

/** A single function-call test case: call fn(...input) and deep-equal vs expected. */
export interface TestCase {
  input: unknown[];
  expected: unknown;
  /** Hidden cases run but their input/expected aren't revealed to the solver. */
  hidden?: boolean;
}

/** Outcome of running the user's function against one test case. */
export interface CaseResult {
  passed: boolean;
  input: unknown[];
  expected: unknown;
  actual?: unknown;
  hidden: boolean;
  /** Set when the user's code threw on this case. */
  error?: string;
}

/**
 * Message the main thread posts into the worker.
 * - `mode: "tests"` (default) calls `fnName` against `testCases` (Code Dojo).
 * - `mode: "scratch"` just executes `code` and captures console output, with no
 *   assertions — used as a free scratchpad in the interview coding flow.
 */
export interface RunRequest {
  code: string;
  fnName?: string;
  testCases?: TestCase[];
  mode?: "tests" | "scratch";
}

/** Worker reply for a `tests`-mode run. */
export type RunResponse =
  | { ok: true; results: CaseResult[]; logs: string[]; runtimeMs: number }
  | { ok: false; error: string; logs: string[] };

/** Worker reply for a `scratch`-mode run (console output only, no assertions). */
export type ScratchResponse =
  | { ok: true; logs: string[]; runtimeMs: number }
  | { ok: false; error: string; logs: string[] };

/** The scratchpad hook's observable state. */
export type ScratchState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; logs: string[]; runtimeMs: number }
  | { status: "timeout"; logs: string[] }
  | { status: "error"; error: string; logs: string[] };

/** Resolved value of `run()` — lets the caller react in an event handler. */
export type RunOutcome =
  | { kind: "done"; passed: number; total: number; runtimeMs: number }
  | { kind: "timeout" }
  | { kind: "error"; error: string }
  | { kind: "cancelled" };

/** The hook's externally-observable state machine. */
export type RunState =
  | { status: "idle" }
  | { status: "running" }
  | {
      status: "done";
      results: CaseResult[];
      logs: string[];
      runtimeMs: number;
      passed: number;
      total: number;
    }
  | { status: "timeout"; logs: string[] }
  | { status: "error"; error: string; logs: string[] };
