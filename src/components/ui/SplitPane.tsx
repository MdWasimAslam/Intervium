"use client";

import { useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const PREFIX = "intervium.split.";

function readStored(key?: string): number | null {
  if (!key) return null;
  try {
    const v = window.localStorage.getItem(PREFIX + key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function writeStored(key: string, px: number) {
  try {
    window.localStorage.setItem(PREFIX + key, String(Math.round(px)));
  } catch {
    /* ignore */
  }
}

/**
 * Vertical split: a resizable `top` pane (drag the divider) with `bottom`
 * flowing beneath. Delta-based pointer drag (one path for mouse/touch/pen),
 * persisted height. On coarse pointers it just stacks (no divider). `onResize`
 * fires during/after a drag so consumers can re-layout (e.g. Monaco).
 */
export function SplitPane({
  top,
  bottom,
  storageKey,
  initialTopPx = 440,
  minTop = 200,
  maxTop = 1200,
  disabled = false,
  onResize,
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  storageKey?: string;
  initialTopPx?: number;
  minTop?: number;
  maxTop?: number;
  disabled?: boolean;
  onResize?: () => void;
}) {
  const [topPx, setTopPx] = useState(() => readStored(storageKey) ?? initialTopPx);
  const drag = useRef<{ y: number; h: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    drag.current = { y: e.clientY, h: topPx };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const next = Math.max(
      minTop,
      Math.min(maxTop, drag.current.h + (e.clientY - drag.current.y)),
    );
    setTopPx(next);
    onResize?.();
  }
  function endDrag(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (storageKey) writeStored(storageKey, topPx);
    onResize?.();
  }

  if (disabled) {
    return (
      <div className="flex flex-col gap-3">
        <div style={{ height: 360 }}>{top}</div>
        {bottom}
      </div>
    );
  }

  return (
    <div>
      <div style={{ height: topPx }}>{top}</div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "group flex h-4 cursor-row-resize touch-none items-center justify-center",
        )}
      >
        <span className="flex h-1.5 w-12 items-center justify-center rounded-full bg-[var(--border)] transition-colors group-hover:bg-[var(--primary)]/50">
          <GripHorizontal className="h-3 w-3 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
        </span>
      </div>
      <div>{bottom}</div>
    </div>
  );
}
