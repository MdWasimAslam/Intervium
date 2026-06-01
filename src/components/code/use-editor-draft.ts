"use client";

import { useCallback, useEffect, useRef } from "react";

const PREFIX = "intervium.draft.";
const MAX = 50_000;

/** Read a saved draft for a key (null on SSR / none / error). */
export function readDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** Remove a saved draft. */
export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

function writeDraft(key: string, code: string) {
  try {
    if (code.length > MAX) return; // don't persist absurdly large buffers
    window.localStorage.setItem(PREFIX + key, code);
  } catch {
    /* quota / disabled storage — ignore */
  }
}

/**
 * Debounced autosave for an in-progress editor draft, keyed per problem. Seed
 * the editor with `readDraft(key)` (restore precedence: draft > server attempt >
 * starter), call `save(code)` on every change, and `clear()` once the work is
 * committed (e.g. a successful Submit) so the server copy becomes canonical.
 * Saves skipped when the code still equals `skipIf` (the starter template).
 */
export function useEditorDraft(key: string, skipIf?: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = useCallback(
    (code: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (skipIf !== undefined && code === skipIf) clearDraft(key);
        else writeDraft(key, code);
      }, 600);
    },
    [key, skipIf],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    clearDraft(key);
  }, [key]);

  return { save, clear };
}
