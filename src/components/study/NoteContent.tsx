"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";
import { ReadAloud } from "@/components/study/ReadAloud";
import { updateNote } from "@/lib/actions/study";
import type { StudyNoteRow } from "@/lib/study/types";

type Mode = "preview" | "raw";

/**
 * A note's body with a Preview/Raw toggle. Preview renders Markdown (default);
 * Raw shows the source in an editable textarea that saves directly. Editing in
 * Raw preserves every other field, so it's a quick inline content edit.
 */
export function NoteContent({ note }: { note: StudyNoteRow }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("preview");
  const [draft, setDraft] = useState(note.content ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const dirty = draft !== (note.content ?? "");
  // A flashcard must keep an answer; a plain note must keep some content.
  const canSave = dirty && draft.trim().length > 0;

  function save() {
    setError(undefined);
    start(async () => {
      const res = await updateNote({
        id: note.id,
        title: note.title,
        folderId: note.folderId,
        isFlashcard: note.isFlashcard,
        tags: note.tags,
        content: draft,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {note.isFlashcard && (
          <span className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Answer
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {mode === "preview" && note.content && (
            <ReadAloud text={`${note.title}. ${note.content}`} />
          )}
          <div className="inline-flex rounded-md border border-[var(--border)] p-0.5 text-xs">
            <ToggleButton
              active={mode === "preview"}
              onClick={() => setMode("preview")}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </ToggleButton>
            <ToggleButton
              active={mode === "raw"}
              onClick={() => setMode("raw")}
            >
              <Pencil className="h-3.5 w-3.5" /> Raw
            </ToggleButton>
          </div>
        </div>
      </div>

      {mode === "preview" ? (
        note.content ? (
          <Markdown variant="colorful">{note.content}</Markdown>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            (No content.)
          </p>
        )
      ) : (
        <div className="space-y-2">
          <Textarea
            value={draft}
            rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))}
            maxLength={50_000}
            className="font-mono text-sm"
            onChange={(e) => setDraft(e.target.value)}
          />
          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={!canSave || pending}>
              <Check className="h-4 w-4" /> Save
            </Button>
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setDraft(note.content ?? "")}
              >
                Discard
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors",
        active
          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}
