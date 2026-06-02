/// <reference lib="webworker" />
/**
 * Sandboxed JS runner. Receives the user's source + a function name + test
 * cases, defines the function, runs it against every case, and reports
 * pass/fail + captured console output + runtime.
 *
 * It can't stop itself on an infinite loop — the main thread (useJsRunner) arms
 * a timeout and `terminate()`s this worker if it hangs. A worker has no DOM or
 * network access, so user code is contained.
 */
import type {
  CaseResult,
  RunnerLogMessage,
  RunRequest,
  RunResponse,
  ScratchResponse,
  TestCase,
} from "./types";

/** Structural deep-equality for JSON-like values (handles NaN, arrays, objects). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  const aArr = Array.isArray(a);
  if (aArr !== Array.isArray(b)) return false;
  if (aArr) {
    const x = a as unknown[];
    const y = b as unknown[];
    return x.length === y.length && x.every((v, i) => deepEqual(v, y[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const xk = Object.keys(x);
  const yk = Object.keys(y);
  return xk.length === yk.length && xk.every((k) => deepEqual(x[k], y[k]));
}

/** Human-readable rendering of a console.log argument. */
function format(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Defensive structured clone so a mutating solution can't corrupt later cases. */
function clone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

// Harden the sandbox: user code gets no network or module loading. (DOM is
// already unavailable in a worker; runaway loops are killed by the main thread's
// terminate-on-timeout — this just closes the remaining escape hatches.)
const blocked = () => {
  throw new Error("Network/import is disabled in the sandbox.");
};
const g = self as unknown as Record<string, unknown>;
for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "importScripts", "EventSource"]) {
  try {
    g[k] = blocked;
  } catch {
    /* some are non-writable; ignore */
  }
}

// Cap captured output so a tight `while(true){ console.log() }` can't exhaust
// memory before the timeout fires.
const MAX_LOGS = 1000;
// Stream a snapshot of captured output every N lines so a timeout-kill can
// still surface what ran (only delivered if the code yields to the event loop).
const STREAM_EVERY_N_LOGS = 25;

self.onmessage = (e: MessageEvent<RunRequest>) => {
  const { code, fnName, testCases, mode } = e.data;
  const logs: string[] = [];
  let streamed = 0;

  // Capture console.log/info/warn/error without leaking the worker's own console.
  const sink = (...args: unknown[]) => {
    if (logs.length < MAX_LOGS) logs.push(args.map(format).join(" "));
    else if (logs.length === MAX_LOGS) logs.push("… output truncated");
    if (logs.length - streamed >= STREAM_EVERY_N_LOGS) {
      streamed = logs.length;
      self.postMessage({ partial: true, logs: logs.slice() } as RunnerLogMessage);
    }
  };
  const console = self.console;
  console.log = sink;
  console.info = sink;
  console.warn = sink;
  console.error = sink;

  // Scratchpad: just run the code and report console output — no assertions.
  if (mode === "scratch") {
    const reply = (msg: ScratchResponse) => self.postMessage(msg);
    try {
      const exec = new Function(`"use strict";\n${code}\n`);
      const start = performance.now();
      exec();
      reply({ ok: true, logs, runtimeMs: performance.now() - start });
    } catch (err) {
      reply({ ok: false, error: String(err), logs });
    }
    return;
  }

  const respond = (msg: RunResponse) => self.postMessage(msg);

  if (!fnName || !testCases) {
    respond({ ok: false, error: "No function or test cases provided.", logs });
    return;
  }

  let fn: unknown;
  try {
    // Define the user's code, then hand back the named function. Function
    // declarations hoist within this scope, so order doesn't matter.
    const factory = new Function(
      `"use strict";\n${code}\n;return typeof ${fnName} === "function" ? ${fnName} : undefined;`,
    );
    fn = factory();
  } catch (err) {
    respond({ ok: false, error: `Syntax error: ${String(err)}`, logs });
    return;
  }

  if (typeof fn !== "function") {
    respond({
      ok: false,
      error: `Couldn't find a function named "${fnName}". Define it and try again.`,
      logs,
    });
    return;
  }

  const call = fn as (...args: unknown[]) => unknown;
  const results: CaseResult[] = [];
  const start = performance.now();

  for (const tc of testCases as TestCase[]) {
    const hidden = tc.hidden ?? false;
    try {
      const actual = call(...clone(tc.input));
      results.push({
        passed: deepEqual(actual, tc.expected),
        input: tc.input,
        expected: tc.expected,
        actual,
        hidden,
      });
    } catch (err) {
      results.push({
        passed: false,
        input: tc.input,
        expected: tc.expected,
        hidden,
        error: String(err),
      });
    }
  }

  respond({ ok: true, results, logs, runtimeMs: performance.now() - start });
};
