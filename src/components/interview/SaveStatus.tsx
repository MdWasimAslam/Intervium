import { Cloud, CloudOff } from "lucide-react";

/**
 * Subtle, non-blocking indicator of background answer saving. Shown only while
 * answers are still in flight — it never gates the answering UI.
 */
export function SaveStatus({
  unsavedCount,
  hasFailure,
}: {
  unsavedCount: number;
  hasFailure: boolean;
}) {
  if (unsavedCount === 0) return null;
  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
      {hasFailure ? (
        <>
          <CloudOff className="h-3.5 w-3.5 text-[var(--destructive)]" />
          Couldn&apos;t save yet — we&apos;ll retry. Your answers are kept.
        </>
      ) : (
        <>
          <Cloud className="h-3.5 w-3.5 animate-pulse" />
          Saving your answer…
        </>
      )}
    </p>
  );
}
