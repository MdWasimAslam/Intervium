import { Sparkles } from "lucide-react";

/**
 * A thin banner reminding the demo account that AI is off and edits may reset.
 * Presentational — the app layout decides when to render it (demo account only).
 */
export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-1.5 border-b border-[var(--warning)]/30 bg-[var(--warning-subtle)] px-4 py-1.5 text-center text-xs font-medium text-[var(--warning)]">
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>
        Demo mode — AI features are turned off, and this is a shared account, so
        edits may be reset.
      </span>
    </div>
  );
}
