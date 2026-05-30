"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, PartyPopper, X } from "lucide-react";

const noop = () => () => {};

/**
 * Subtle "new personal best" celebration shown when the most recent scored
 * session beat every prior one. Dismissible per-best via sessionStorage so it
 * appears once per achievement and never nags. CSS-only entrance keeps it
 * reduced-motion friendly (`animate-fade-up` is a fade + small translate).
 */
export function MilestoneBanner({
  bestPct,
  sessionId,
}: {
  bestPct: number;
  sessionId: string | null;
}) {
  const storageKey = `milestone-dismissed-${sessionId ?? "latest"}`;

  // Read the persisted "already dismissed" flag without a setState-in-effect.
  // The server snapshot renders nothing; the client snapshot reveals it after
  // hydration if it hasn't been dismissed yet.
  const persistedDismissed = useSyncExternalStore(
    noop,
    () => sessionStorage.getItem(storageKey) === "1",
    () => true,
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (persistedDismissed || dismissedNow) return null;

  function dismiss() {
    sessionStorage.setItem(storageKey, "1");
    setDismissedNow(true);
  }

  return (
    <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-[var(--primary)]/30 bg-[var(--accent)] p-4 text-[var(--accent-foreground)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
        <PartyPopper className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">New personal best — {bestPct}%! 🎉</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your latest interview is your highest score yet. Keep the momentum
          going.
        </p>
      </div>
      {sessionId && (
        <Link
          href={`/interview/${sessionId}/results`}
          className="hidden shrink-0 items-center gap-1 text-sm font-medium text-[var(--primary)] transition-colors hover:opacity-80 sm:inline-flex"
        >
          View
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
