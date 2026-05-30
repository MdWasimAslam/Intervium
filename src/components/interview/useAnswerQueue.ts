"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAnswer } from "@/lib/actions/interview";

export interface AnswerPayload {
  answer: string;
  timeTaken: number;
  /** Voice mode only — mirrored into user_answer by saveAnswer. */
  transcript?: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Optimistic background persistence for interview answers.
 *
 * `enqueue` records an answer and fires its save WITHOUT blocking, so the UI
 * can advance to the next question instantly. Saves retry on failure, and the
 * latest answer for a position always wins. `flush` (called right before
 * finishing) blocks only long enough to guarantee every answer reached the DB
 * — so scoring never runs against a half-saved session.
 *
 * A typed answer is never lost: it stays in the queue until confirmed saved,
 * and a beforeunload guard warns if the tab is closed mid-save.
 */
export function useAnswerQueue(sessionId: string) {
  // Latest unsaved payload per position (cleared once confirmed saved).
  const pending = useRef(new Map<number, AnswerPayload>());
  const inFlight = useRef(new Set<number>());
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [hasFailure, setHasFailure] = useState(false);

  const sync = useCallback(() => setUnsavedCount(pending.current.size), []);

  const trySave = useCallback(
    async (position: number) => {
      if (inFlight.current.has(position)) return;
      const payload = pending.current.get(position);
      if (!payload) return;

      inFlight.current.add(position);
      let ok = false;
      try {
        const res = await saveAnswer({ sessionId, position, ...payload });
        ok = res.ok;
      } catch {
        ok = false;
      }
      inFlight.current.delete(position);

      // Only clear if this exact payload is still the latest for the position
      // (a newer answer may have been enqueued while this save was in flight).
      if (ok && pending.current.get(position) === payload) {
        pending.current.delete(position);
      }
      // Soft indicator: a save just failed and answers are still queued.
      setHasFailure(!ok && pending.current.size > 0);
      sync();
    },
    [sessionId, sync],
  );

  /** Record an answer and kick off its save in the background. Never blocks. */
  const enqueue = useCallback(
    (position: number, payload: AnswerPayload) => {
      pending.current.set(position, payload);
      sync();
      void trySave(position);
    },
    [sync, trySave],
  );

  /** Block until the queue drains (or we give up after a few rounds). */
  const flush = useCallback(async () => {
    for (let round = 0; round < 4 && pending.current.size > 0; round++) {
      await Promise.all([...pending.current.keys()].map((p) => trySave(p)));
      if (pending.current.size > 0) await wait(400 * (round + 1));
    }
    const drained = pending.current.size === 0;
    setHasFailure(!drained);
    return drained;
  }, [trySave]);

  // Warn before leaving if answers are still saving, so none are lost silently.
  useEffect(() => {
    if (unsavedCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedCount]);

  return { enqueue, flush, unsavedCount, hasFailure };
}
