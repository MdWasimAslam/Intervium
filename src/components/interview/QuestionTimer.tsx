"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface QuestionTimerProps {
  seconds: number;
  /** Called once when the countdown reaches zero. */
  onExpire: () => void;
  /** Seconds remaining at which to show the warning state. */
  warnAt?: number;
}

/**
 * Per-question countdown. Mount it with a `key` per question so it resets
 * cleanly. State is initialised from props; the interval mutates state only
 * from its async callback, and the latest onExpire is tracked in an effect.
 */
export function QuestionTimer({
  seconds,
  onExpire,
  warnAt = 15,
}: QuestionTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const expireRef = useRef(onExpire);

  // Keep the latest onExpire without re-running the interval effect.
  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fire onExpire exactly once when we hit zero.
  useEffect(() => {
    if (remaining === 0) expireRef.current();
  }, [remaining]);

  const warning = remaining <= warnAt;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = (remaining / seconds) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">Time remaining</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            warning ? "text-[var(--destructive)]" : "text-[var(--foreground)]",
          )}
        >
          {mm}:{ss}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            warning ? "bg-[var(--destructive)]" : "bg-[var(--primary)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
