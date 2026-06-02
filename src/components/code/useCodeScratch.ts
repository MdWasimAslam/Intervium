"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunnerLogMessage, ScratchResponse, ScratchState } from "./types";

const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Runs arbitrary JavaScript in a throwaway Web Worker and surfaces its console
 * output — a free scratchpad, with no assertions or scoring. Used in the
 * interview coding flow so candidates can sanity-check their code before
 * submitting. Shares the runner worker with {@link useJsRunner} (scratch mode).
 */
export function useCodeScratch() {
  const [state, setState] = useState<ScratchState>({ status: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const run = useCallback(
    (code: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
      teardown();
      setState({ status: "running" });

      const worker = new Worker(new URL("./runner.worker.ts", import.meta.url));
      workerRef.current = worker;
      // Latest streamed console output, so a timeout-kill can still show it.
      let streamedLogs: string[] = [];

      timerRef.current = setTimeout(() => {
        teardown();
        setState({ status: "timeout", logs: streamedLogs });
      }, timeoutMs);

      worker.onmessage = (e: MessageEvent<ScratchResponse | RunnerLogMessage>) => {
        const data = e.data;
        if ("partial" in data) {
          streamedLogs = data.logs;
          return;
        }
        teardown();
        if (data.ok) {
          setState({ status: "done", logs: data.logs, runtimeMs: data.runtimeMs });
        } else {
          setState({ status: "error", error: data.error, logs: data.logs });
        }
      };

      worker.onerror = (err) => {
        teardown();
        setState({
          status: "error",
          error: err.message || "The runner crashed.",
          logs: [],
        });
      };

      worker.postMessage({ code, mode: "scratch" });
    },
    [teardown],
  );

  /** Cancel an in-flight run and return to idle. */
  const cancel = useCallback(() => {
    teardown();
    setState({ status: "idle" });
  }, [teardown]);

  return { state, run, cancel };
}
