"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createNote, updateNote, type NoteInput } from "@/lib/actions/study";
import { flattenForSelect } from "@/lib/study/tree";
import type { FolderInput, StudyNoteRow } from "@/lib/study/types";
import { TagInput } from "./TagInput";

const ROOT = "__root__";

export interface NoteDialogProps {
  folders: FolderInput[];
  allTags: string[];
  trigger: ReactNode;
  /** Existing note to edit; omit to create. */
  note?: StudyNoteRow;
  /** Preselected folder when creating from inside a folder view. */
  defaultFolderId?: string | null;
}

export function NoteDialog({
  folders,
  allTags,
  trigger,
  note,
  defaultFolderId = null,
}: NoteDialogProps) {
  const router = useRouter();
  const editing = Boolean(note);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(note?.title ?? "");
  const [folderId, setFolderId] = useState<string | null>(
    note?.folderId ?? defaultFolderId,
  );
  const [isFlashcard, setIsFlashcard] = useState(note?.isFlashcard ?? false);
  const [content, setContent] = useState(note?.content ?? "");
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const options = flattenForSelect(folders);

  function reset() {
    setTitle(note?.title ?? "");
    setFolderId(note?.folderId ?? defaultFolderId);
    setIsFlashcard(note?.isFlashcard ?? false);
    setContent(note?.content ?? "");
    setTags(note?.tags ?? []);
    setError(undefined);
  }

  function submit() {
    setError(undefined);
    const payload: NoteInput = {
      title,
      folderId,
      isFlashcard,
      content,
      tags,
    };
    start(async () => {
      const res = note
        ? await updateNote({ ...payload, id: note.id })
        : await createNote(payload);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit note" : "New note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-title">
              {isFlashcard ? "Question (front)" : "Title"}
            </Label>
            <Input
              id="note-title"
              value={title}
              autoFocus
              maxLength={200}
              placeholder={
                isFlashcard
                  ? "e.g. How do closures capture variables?"
                  : "e.g. How closures capture variables"
              }
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5">
            <div>
              <Label htmlFor="note-flashcard">Flashcard</Label>
              <p className="text-xs text-[var(--muted-foreground)]">
                The title becomes the question; this card enters the review
                queue.
              </p>
            </div>
            <Switch
              id="note-flashcard"
              checked={isFlashcard}
              onCheckedChange={setIsFlashcard}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-content">
              {isFlashcard ? "Answer (back)" : "Content"}
              <span className="ml-1 font-normal text-[var(--muted-foreground)]">
                · Markdown
              </span>
            </Label>
            <Textarea
              id="note-content"
              value={content}
              rows={isFlashcard ? 5 : 8}
              maxLength={50_000}
              placeholder="Write in Markdown. Use ``` for code blocks, and {{c1::hidden}} to make a click-to-reveal blank for active recall."
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Folder</Label>
              <Select
                value={folderId ?? ROOT}
                onValueChange={(v) => setFolderId(v === ROOT ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT}>Unfiled</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {" ".repeat(o.depth * 2)}
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <TagInput value={tags} onChange={setTags} suggestions={allTags} />
            </div>
          </div>

          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={pending}
              disabled={!title.trim()}
              onClick={submit}
            >
              {editing ? "Save" : "Create note"}
            </LoadingButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
