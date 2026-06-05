"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StudyNoteRow } from "@/lib/study/types";

export interface ExportDialogProps {
  /** The notes currently in view (already filtered server-side). */
  notes: StudyNoteRow[];
  trigger: ReactNode;
}

/**
 * Export the notes currently in view as JSON. Pure client-side — the notes are
 * already in props, so this just serializes a clean subset (no DB ids / SR
 * state) and offers copy + download.
 */
export function ExportDialog({ notes, trigger }: ExportDialogProps) {
  const [copied, setCopied] = useState(false);

  const json = useMemo(
    () =>
      JSON.stringify(
        notes.map((n) => ({
          title: n.title,
          content: n.content ?? "",
          isFlashcard: n.isFlashcard,
          tags: n.tags,
        })),
        null,
        2,
      ),
    [notes],
  );

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
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export notes</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              {notes.length} note{notes.length === 1 ? "" : "s"} in view, as
              JSON.
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={copy}
                disabled={notes.length === 0}
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
                disabled={notes.length === 0}
              >
                Download
              </Button>
            </div>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 font-mono text-xs leading-relaxed text-[var(--muted-foreground)]">
            {notes.length === 0 ? "[]" : json}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
