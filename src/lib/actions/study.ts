"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, studyFolders, studyNotes } from "@db";
import { withTransaction } from "@db/tx";
import { getCurrentUser } from "@/lib/session";
import { schedule } from "@/lib/spaced-repetition";
import { listFolders } from "@/lib/study/queries";
import { wouldCreateCycle } from "@/lib/study/tree";
import type { Result } from "@/lib/actions/result";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Normalize free-form tags: drop a leading "#", lowercase, trim, dedupe. */
function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = raw.replace(/^#+/, "").trim().toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen].slice(0, 10);
}

/** Confirm a folder exists and belongs to this user. */
async function ownsFolder(userId: string, folderId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: studyFolders.id })
    .from(studyFolders)
    .where(and(eq(studyFolders.id, folderId), eq(studyFolders.userId, userId)));
  return Boolean(row);
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

const noteSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    folderId: z.string().uuid().nullable().optional(),
    content: z.string().max(50_000).optional(),
    isFlashcard: z.boolean().default(false),
    tags: z.array(z.string().max(40)).max(20).optional(),
  })
  .superRefine((v, ctx) => {
    // For a flashcard the title is the question (front); content is the answer.
    if (v.isFlashcard && !v.content?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A flashcard needs an answer.",
        path: ["content"],
      });
    } else if (!v.isFlashcard && !v.content?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A note needs some content.",
        path: ["content"],
      });
    }
  });

export type NoteInput = z.input<typeof noteSchema>;

export async function createNote(
  input: NoteInput,
): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note.",
    };
  }
  const d = parsed.data;

  if (d.folderId && !(await ownsFolder(user.id, d.folderId))) {
    return { ok: false, error: "Folder not found." };
  }

  try {
    const [row] = await db
      .insert(studyNotes)
      .values({
        userId: user.id,
        folderId: d.folderId ?? null,
        title: d.title,
        content: d.content?.trim() ? d.content : null,
        isFlashcard: d.isFlashcard,
        tags: normalizeTags(d.tags),
      })
      .returning({ id: studyNotes.id });
    revalidatePath("/study");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    console.error("[createNote]", error);
    return { ok: false, error: "Could not save the note." };
  }
}

const updateSchema = z.object({ id: z.string().uuid() });

export async function updateNote(
  input: NoteInput & { id: string },
): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const id = updateSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid note." };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note.",
    };
  }
  const d = parsed.data;

  if (d.folderId && !(await ownsFolder(user.id, d.folderId))) {
    return { ok: false, error: "Folder not found." };
  }

  try {
    const updated = await db
      .update(studyNotes)
      .set({
        folderId: d.folderId ?? null,
        title: d.title,
        content: d.content?.trim() ? d.content : null,
        isFlashcard: d.isFlashcard,
        tags: normalizeTags(d.tags),
        updatedAt: new Date(),
      })
      .where(and(eq(studyNotes.id, input.id), eq(studyNotes.userId, user.id)))
      .returning({ id: studyNotes.id });
    if (updated.length === 0) return { ok: false, error: "Note not found." };
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[updateNote]", error);
    return { ok: false, error: "Could not update the note." };
  }
}

export async function deleteNote(input: { id: string }): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid note." };

  try {
    const deleted = await db
      .delete(studyNotes)
      .where(and(eq(studyNotes.id, p.data.id), eq(studyNotes.userId, user.id)))
      .returning({ id: studyNotes.id });
    if (deleted.length === 0) return { ok: false, error: "Note not found." };
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[deleteNote]", error);
    return { ok: false, error: "Could not delete the note." };
  }
}

export async function archiveNote(input: {
  id: string;
  archived: boolean;
}): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z
    .object({ id: z.string().uuid(), archived: z.boolean() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };

  try {
    const updated = await db
      .update(studyNotes)
      .set({ isArchived: p.data.archived, updatedAt: new Date() })
      .where(and(eq(studyNotes.id, p.data.id), eq(studyNotes.userId, user.id)))
      .returning({ id: studyNotes.id });
    if (updated.length === 0) return { ok: false, error: "Note not found." };
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[archiveNote]", error);
    return { ok: false, error: "Could not update the note." };
  }
}

export async function togglePinNote(input: {
  id: string;
  pinned: boolean;
}): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z
    .object({ id: z.string().uuid(), pinned: z.boolean() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };

  try {
    const updated = await db
      .update(studyNotes)
      .set({ isPinned: p.data.pinned, updatedAt: new Date() })
      .where(and(eq(studyNotes.id, p.data.id), eq(studyNotes.userId, user.id)))
      .returning({ id: studyNotes.id });
    if (updated.length === 0) return { ok: false, error: "Note not found." };
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[togglePinNote]", error);
    return { ok: false, error: "Could not pin the note." };
  }
}

/** Stamp a note as just-viewed (powers recently-viewed/resume). Best-effort. */
export async function markNoteViewed(input: {
  id: string;
}): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid note." };

  try {
    // No revalidate: this fires on open and shouldn't re-render the page.
    await db
      .update(studyNotes)
      .set({ lastViewedAt: new Date() })
      .where(and(eq(studyNotes.id, p.data.id), eq(studyNotes.userId, user.id)));
    return { ok: true, data: true };
  } catch (error) {
    console.error("[markNoteViewed]", error);
    return { ok: false, error: "Could not record the view." };
  }
}

/**
 * Record a spaced-repetition self-rating for a flashcard, advancing the SM-2
 * schedule and setting the next due date. Mirrors `rateDojoQuestion`.
 */
export async function rateStudyNote(input: {
  id: string;
  rating: "again" | "hard" | "good" | "easy";
}): Promise<Result<{ dueInDays: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z
    .object({
      id: z.string().uuid(),
      rating: z.enum(["again", "hard", "good", "easy"]),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid rating." };
  const { id, rating } = p.data;

  try {
    const [note] = await db
      .select({
        ease: studyNotes.ease,
        intervalDays: studyNotes.intervalDays,
        isFlashcard: studyNotes.isFlashcard,
      })
      .from(studyNotes)
      .where(and(eq(studyNotes.id, id), eq(studyNotes.userId, user.id)));
    if (!note) return { ok: false, error: "Card not found." };
    if (!note.isFlashcard)
      return { ok: false, error: "Only flashcards can be reviewed." };

    const next = schedule(
      { ease: note.ease, intervalDays: note.intervalDays },
      rating,
    );
    // "Again" returns 0 days; floor it so the card leaves the immediate due
    // queue (otherwise dueAt === now and it loops instantly).
    const AGAIN_FLOOR_MS = 10 * 60_000;
    const dueMs = next.dueInDays * 86_400_000;
    const dueAt = new Date(Date.now() + (dueMs > 0 ? dueMs : AGAIN_FLOOR_MS));

    await db
      .update(studyNotes)
      .set({
        ease: next.ease,
        intervalDays: next.intervalDays,
        dueAt,
        lastRating: rating,
        lastReviewedAt: new Date(),
        reviewCount: sql`${studyNotes.reviewCount} + 1`,
      })
      .where(and(eq(studyNotes.id, id), eq(studyNotes.userId, user.id)));

    revalidatePath("/study/review");
    revalidatePath("/study");
    return { ok: true, data: { dueInDays: next.dueInDays } };
  } catch (error) {
    console.error("[rateStudyNote]", error);
    return { ok: false, error: "Could not save your rating." };
  }
}

/* -------------------------------------------------------------------------- */
/* Folders                                                                    */
/* -------------------------------------------------------------------------- */

const folderNameSchema = z.string().trim().min(1, "Name is required.").max(120);

export async function createFolder(input: {
  name: string;
  parentId?: string | null;
}): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z
    .object({
      name: folderNameSchema,
      parentId: z.string().uuid().nullable().optional(),
    })
    .safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: p.error.issues[0]?.message ?? "Invalid folder.",
    };
  }

  if (p.data.parentId && !(await ownsFolder(user.id, p.data.parentId))) {
    return { ok: false, error: "Parent folder not found." };
  }

  try {
    const [row] = await db
      .insert(studyFolders)
      .values({
        userId: user.id,
        name: p.data.name,
        parentId: p.data.parentId ?? null,
      })
      .returning({ id: studyFolders.id });
    revalidatePath("/study");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    console.error("[createFolder]", error);
    return { ok: false, error: "Could not create the folder." };
  }
}

export async function renameFolder(input: {
  id: string;
  name: string;
}): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z
    .object({ id: z.string().uuid(), name: folderNameSchema })
    .safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: p.error.issues[0]?.message ?? "Invalid folder.",
    };
  }

  try {
    const updated = await db
      .update(studyFolders)
      .set({ name: p.data.name, updatedAt: new Date() })
      .where(
        and(eq(studyFolders.id, p.data.id), eq(studyFolders.userId, user.id)),
      )
      .returning({ id: studyFolders.id });
    if (updated.length === 0) return { ok: false, error: "Folder not found." };
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[renameFolder]", error);
    return { ok: false, error: "Could not rename the folder." };
  }
}

export async function moveFolder(input: {
  id: string;
  parentId: string | null;
}): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z
    .object({ id: z.string().uuid(), parentId: z.string().uuid().nullable() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const { id, parentId } = p.data;

  const folders = await listFolders(user.id);
  if (!folders.some((f) => f.id === id))
    return { ok: false, error: "Folder not found." };
  if (parentId && !folders.some((f) => f.id === parentId))
    return { ok: false, error: "Target folder not found." };
  if (wouldCreateCycle(folders, id, parentId)) {
    return { ok: false, error: "Can't move a folder into itself." };
  }

  try {
    await db
      .update(studyFolders)
      .set({ parentId, updatedAt: new Date() })
      .where(and(eq(studyFolders.id, id), eq(studyFolders.userId, user.id)));
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[moveFolder]", error);
    return { ok: false, error: "Could not move the folder." };
  }
}

/**
 * Delete a folder non-destructively: reparent its child folders and notes up to
 * its own parent (or root), then remove the folder. Never deletes notes.
 */
export async function deleteFolder(input: {
  id: string;
}): Promise<Result<true>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const p = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid folder." };
  const { id } = p.data;

  const [folder] = await db
    .select({ parentId: studyFolders.parentId })
    .from(studyFolders)
    .where(and(eq(studyFolders.id, id), eq(studyFolders.userId, user.id)));
  if (!folder) return { ok: false, error: "Folder not found." };
  const newParent = folder.parentId;

  try {
    await withTransaction(async (tx) => {
      await tx
        .update(studyNotes)
        .set({ folderId: newParent })
        .where(
          and(eq(studyNotes.folderId, id), eq(studyNotes.userId, user.id)),
        );
      await tx
        .update(studyFolders)
        .set({ parentId: newParent })
        .where(
          and(eq(studyFolders.parentId, id), eq(studyFolders.userId, user.id)),
        );
      await tx
        .delete(studyFolders)
        .where(and(eq(studyFolders.id, id), eq(studyFolders.userId, user.id)));
    });
    revalidatePath("/study");
    return { ok: true, data: true };
  } catch (error) {
    console.error("[deleteFolder]", error);
    return { ok: false, error: "Could not delete the folder." };
  }
}
