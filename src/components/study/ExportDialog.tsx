"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { exportNotesAction, type ExportNote } from "@/lib/actions/study";

/** Current list filters, so Export pulls the whole filtered set (not just the page). */
export interface ExportFilter {
  /** undefined → all folders, null → unfiled, uuid → that folder. */
  folderId?: string | null;
  includeSubfolders?: boolean;
  tag?: string;
  q?: string;
}

export interface ExportDialogProps {
  filter: ExportFilter;
  trigger: ReactNode;
}

/**
 * Export every note matching the current filters as JSON. The notes are fetched
 * on open via a server action (NOT the paginated page in view), then serialized
 * to a clean subset (no DB ids / SR state) with copy + download.
 */
export function ExportDialog({ filter, trigger }: ExportDialogProps) {
  const [notes, setNotes] = useState<ExportNote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(undefined);
    const res = await exportNotesAction(filter);
    if (res.ok) setNotes(res.data);
    else setError(res.error);
    setLoading(false);
  }

  function onOpenChange(next: boolean) {
    if (next) {
      // Re-fetch each time it opens so the export reflects the live filter set.
      setNotes(null);
      setCopied(false);
      void load();
    }
  }

  const json = useMemo(() => JSON.stringify(notes ?? [], null, 2), [notes]);

  const count = notes?.length ?? 0;
  const ready = !loading && !error && notes !== null;

  function copy() {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-notes.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export notes</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              {loading ? (
                "Gathering notes…"
              ) : error ? (
                <span className="text-[var(--destructive)]">{error}</span>
              ) : (
                <>
                  {count} note{count === 1 ? "" : "s"} in this view, as JSON.
                </>
              )}
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={copy}
                disabled={!ready || count === 0}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={download}
                disabled={!ready || count === 0}
              >
                Download
              </Button>
            </div>
          </div>
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-[var(--muted-foreground)]">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </span>
            ) : count === 0 ? (
              "[]"
            ) : (
              json
            )}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
