"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunOutcome, RunResponse, RunState, TestCase } from "./types";

const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Runs user JavaScript against test cases in a throwaway Web Worker. A fresh
 * worker is spawned per run and terminated as soon as it answers; if it doesn't
 * answer within `timeoutMs` (e.g. an infinite loop) the main thread terminates
 * it and reports a timeout — the only way to stop a runaway worker.
 *
 * `run()` returns a promise that resolves with the outcome, so callers can save
 * results / update state from an event handler instead of an effect.
 */
export function useJsRunner() {
  const [state, setState] = useState<RunState>({ status: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef = useRef<((o: RunOutcome) => void) | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    if (resolveRef.current) {
      resolveRef.current({ kind: "cancelled" });
      resolveRef.current = null;
    }
  }, []);

  // Kill any in-flight run if the component unmounts.
  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (
      code: string,
      fnName: string,
      testCases: TestCase[],
      timeoutMs = DEFAULT_TIMEOUT_MS,
    ): Promise<RunOutcome> => {
      cancel();
      setState({ status: "running" });

      return new Promise<RunOutcome>((resolve) => {
        resolveRef.current = resolve;
        const worker = new Worker(new URL("./runner.worker.ts", import.meta.url));
        workerRef.current = worker;

        const settle = (outcome: RunOutcome, next: RunState) => {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = null;
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          setState(next);
          if (resolveRef.current === resolve) {
            resolveRef.current = null;
            resolve(outcome);
          }
        };

        timerRef.current = setTimeout(() => {
          settle({ kind: "timeout" }, { status: "timeout", logs: [] });
        }, timeoutMs);

        worker.onmessage = (e: MessageEvent<RunResponse>) => {
          const data = e.data;
          if (data.ok) {
            const passed = data.results.filter((r) => r.passed).length;
            const total = data.results.length;
            settle(
              { kind: "done", passed, total, runtimeMs: data.runtimeMs },
              {
                status: "done",
                results: data.results,
                logs: data.logs,
                runtimeMs: data.runtimeMs,
                passed,
                total,
              },
            );
          } else {
            settle(
              { kind: "error", error: data.error },
              { status: "error", error: data.error, logs: data.logs },
            );
          }
        };

        worker.onerror = (err) => {
          const msg = err.message || "The runner crashed.";
          settle({ kind: "error", error: msg }, { status: "error", error: msg, logs: [] });
        };

        worker.postMessage({ code, fnName, testCases });
      });
    },
    [cancel],
  );

  const reset = useCallback(() => {
    cancel();
    setState({ status: "idle" });
  }, [cancel]);

  return { state, run, reset };
}
