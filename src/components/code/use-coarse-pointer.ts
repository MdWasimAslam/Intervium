"use client";

import { useEffect, useState } from "react";

/**
 * True on touch / small-screen devices, where Monaco is heavy and awkward — the
 * editor falls back to a plain monospace textarea there. Starts `false` to
 * match SSR, then corrects after mount (no hydration mismatch).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse), (max-width: 640px)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return coarse;
}
