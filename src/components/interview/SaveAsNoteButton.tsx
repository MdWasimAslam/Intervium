"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveQuestionAsNoteAction } from "@/lib/actions/study";

/**
 * Saves one interview question as a study note (title = question, body = ideal
 * answer) so a weak answer is captured for later revision. The action re-reads
 * the question server-side and verifies session ownership; we only pass ids.
 */
export function SaveAsNoteButton({
  sessionId,
  position,
}: {
  sessionId: string;
  position: number;
}) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "exists">("idle");
  const [error, setError] = useState<string>();

  function save() {
    setError(undefined);
    start(async () => {
      const res = await saveQuestionAsNoteAction({ sessionId, position });
      if (res.ok) setStatus(res.data.duplicate ? "exists" : "saved");
      else setError(res.error);
    });
  }

  if (status !== "idle") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success)]">
        <Check className="h-3.5 w-3.5" />
        {status === "exists" ? "Already in" : "Saved to"}{" "}
        <Link
          href="/study"
          className="font-medium underline underline-offset-2"
        >
          Study Notes
        </Link>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={save} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BookmarkPlus className="h-4 w-4" />
        )}
        Save as note
      </Button>
      {error && (
        <span className="text-xs text-[var(--destructive)]">{error}</span>
      )}
    </div>
  );
}
