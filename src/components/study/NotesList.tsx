"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Layers,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import {
  archiveNote,
  deleteNote,
  markNoteViewed,
  togglePinNote,
} from "@/lib/actions/study";
import type { FolderInput, StudyNoteRow } from "@/lib/study/types";
import { NoteContent } from "./NoteContent";
import { NoteDialog } from "./NoteDialog";

export function NotesList({
  notes,
  folders,
  allTags,
}: {
  notes: StudyNoteRow[];
  folders: FolderInput[];
  allTags: string[];
}) {
  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          folders={folders}
          allTags={allTags}
        />
      ))}
    </ul>
  );
}

function NoteCard({
  note,
  folders,
  allTags,
}: {
  note: StudyNoteRow;
  folders: FolderInput[];
  allTags: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    // Stamp as viewed the first time it's expanded (best-effort, no refresh).
    if (next) void markNoteViewed({ id: note.id });
  }

  function pin() {
    start(async () => {
      const res = await togglePinNote({ id: note.id, pinned: !note.isPinned });
      if (res.ok) router.refresh();
    });
  }

  function archive() {
    start(async () => {
      const res = await archiveNote({
        id: note.id,
        archived: !note.isArchived,
      });
      if (res.ok) router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteNote({ id: note.id });
      setConfirming(false);
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] elev-1">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={toggleOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
              !open && "-rotate-90",
            )}
          />
          {note.isPinned && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-[var(--warning)] text-[var(--warning)]" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{note.title}</span>
            {note.tags.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1">
                {note.tags.map((t) => (
                  <Chip key={t} tone="neutral" className="px-2 py-0.5">
                    #{t}
                  </Chip>
                ))}
              </span>
            )}
          </span>
          {note.isFlashcard && (
            <Chip tone="info" className="shrink-0 px-2 py-0.5">
              <Layers className="h-3 w-3" /> Card
            </Chip>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title={note.isPinned ? "Unpin" : "Pin"}
            disabled={pending}
            onClick={pin}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--warning)]"
          >
            <Star
              className={cn(
                "h-4 w-4",
                note.isPinned && "fill-[var(--warning)] text-[var(--warning)]",
              )}
            />
          </button>
          <NoteDialog
            folders={folders}
            allTags={allTags}
            note={note}
            trigger={
              <button
                type="button"
                title="Edit"
                className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Pencil className="h-4 w-4" />
              </button>
            }
          />
          <button
            type="button"
            title={note.isArchived ? "Unarchive" : "Archive"}
            disabled={pending}
            onClick={archive}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {note.isArchived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            title="Delete"
            disabled={pending}
            onClick={() => (confirming ? remove() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            className={cn(
              "flex h-7 items-center justify-center rounded px-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]",
              confirming && "text-[var(--destructive)]",
            )}
          >
            {confirming ? (
              <span className="text-xs font-medium">Sure?</span>
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {open && (
        // Answer sits on a neutral surface a step off the card, so it reads as
        // its own zone set apart from the title row above it while studying.
        <div className="border-t border-[var(--border)] bg-[var(--muted)] px-4 py-4">
          <NoteContent note={note} />
        </div>
      )}
    </li>
  );
}
