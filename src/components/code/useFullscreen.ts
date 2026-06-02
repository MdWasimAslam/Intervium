"use client";

import { useEffect, useState } from "react";

/**
 * Fullscreen toggle for an editor surface. Tracks a `fullscreen` flag plus a
 * `layoutSignal` that bumps whenever the surface resizes (toggling fullscreen
 * or an external drag) so Monaco can re-layout. Escape exits fullscreen.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [layoutSignal, setLayoutSignal] = useState(0);

  const bumpLayout = () => setLayoutSignal((n) => n + 1);
  const toggle = () => {
    setFullscreen((f) => !f);
    bumpLayout();
  };

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFullscreen(false);
        setLayoutSignal((n) => n + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return { fullscreen, toggle, layoutSignal, bumpLayout };
}
