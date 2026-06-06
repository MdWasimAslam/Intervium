"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  interviewSessions,
  jobRoles,
  sessionQuestions,
  studyFolders,
  studyNotes,
  techStacks,
} from "@db";
import { withTransaction } from "@db/tx";
import { getCurrentUser } from "@/lib/session";
import { requireNonDemo } from "@/lib/demo";
import { schedule } from "@/lib/spaced-repetition";
import {
  listFolders,
  listNotes,
  type ListNotesOpts,
} from "@/lib/study/queries";
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

/**
 * Id of an existing non-archived note that is an exact match for this saved
 * question — same title AND body. Title alone is too coarse: two distinct
 * questions can share the first 200 chars (the title slice) yet have different
 * ideal answers, and matching on title only would silently drop the second
 * save. Matching the body too means only a genuine re-save of the same question
 * dedupes; a different question (different answer) is saved as its own note.
 */
async function existingSavedNoteId(
  userId: string,
  title: string,
  content: string | null,
): Promise<string | null> {
  const [row] = await db
    .select({ id: studyNotes.id })
    .from(studyNotes)
    .where(
      and(
        eq(studyNotes.userId, userId),
        eq(studyNotes.title, title),
        content === null
          ? isNull(studyNotes.content)
          : eq(studyNotes.content, content),
        eq(studyNotes.isArchived, false),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

/** A note serialized for export — no DB ids or spaced-repetition state. */
export interface ExportNote {
  title: string;
  content: string;
  isFlashcard: boolean;
  tags: string[];
}

const exportFilterSchema = z.object({
  // undefined → all folders, null → unfiled, uuid → that folder.
  folderId: z.string().uuid().nullable().optional(),
  includeSubfolders: z.boolean().optional(),
  tag: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});

/**
 * Every note matching the given filters (folder/subtree, tag, search) — NOT
 * paginated, so Export captures the whole filtered set, not just the page in
 * view. Scoped to the signed-in user; `listNotes` already restricts by userId.
 */
export async function exportNotesAction(
  input: z.infer<typeof exportFilterSchema>,
): Promise<Result<ExportNote[]>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const parsed = exportFilterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid export filters." };

  const opts: ListNotesOpts = {
    folderId: parsed.data.folderId,
    includeSubfolders: parsed.data.includeSubfolders,
    tag: parsed.data.tag,
    q: parsed.data.q,
  };
  const rows = await listNotes(user.id, opts); // no limit/offset → all matches

  return {
    ok: true,
    data: rows.map((n) => ({
      title: n.title,
      content: n.content ?? "",
      isFlashcard: n.isFlashcard,
      tags: n.tags,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Save-as-note (from interview results)                                      */
/* -------------------------------------------------------------------------- */

const saveQuestionSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number().int().min(0),
});

/**
 * Save one interview question as a study note: title = the question, body =
 * the ideal answer (fenced as code for coding questions), tagged by role + tech.
 * Closes the loop from a weak answer to revisable notes.
 *
 * Re-reads the question server-side and verifies the session belongs to the
 * caller (per-request authorization) — the client only sends sessionId+position,
 * never the note content, so it can't inject arbitrary text under another user.
 */
export async function saveQuestionAsNoteAction(
  input: z.infer<typeof saveQuestionSchema>,
): Promise<Result<{ id: string; duplicate: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const parsed = saveQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const [row] = await db
    .select({
      questionText: sessionQuestions.questionText,
      idealAnswer: sessionQuestions.idealAnswer,
      modality: sessionQuestions.modality,
      role: jobRoles.name,
      tech: techStacks.name,
    })
    .from(sessionQuestions)
    .innerJoin(
      interviewSessions,
      eq(interviewSessions.id, sessionQuestions.sessionId),
    )
    .innerJoin(jobRoles, eq(jobRoles.id, interviewSessions.jobRoleId))
    .innerJoin(techStacks, eq(techStacks.id, interviewSessions.techStackId))
    .where(
      and(
        eq(sessionQuestions.sessionId, parsed.data.sessionId),
        eq(sessionQuestions.position, parsed.data.position),
        eq(interviewSessions.userId, user.id),
      ),
    );
  if (!row) return { ok: false, error: "Question not found." };

  const title = row.questionText.trim().slice(0, 200);

  const ideal = row.idealAnswer.trim();
  // Coding solutions render best fenced; prose answers go in as-is.
  const body = row.modality === "coding" ? "```\n" + ideal + "\n```" : ideal;
  const content = body || null;

  // Don't re-save the same question (e.g. reopening the results page later) —
  // matched on title AND body so a different question that merely shares the
  // title slice still saves as its own note.
  const existing = await existingSavedNoteId(user.id, title, content);
  if (existing) return { ok: true, data: { id: existing, duplicate: true } };

  try {
    const [note] = await db
      .insert(studyNotes)
      .values({
        userId: user.id,
        folderId: null,
        title,
        content,
        isFlashcard: false,
        tags: normalizeTags([row.role, row.tech]),
      })
      .returning({ id: studyNotes.id });
    revalidatePath("/study");
    return { ok: true, data: { id: note.id, duplicate: false } };
  } catch (error) {
    console.error("[saveQuestionAsNoteAction]", error);
    return { ok: false, error: "Could not save the note." };
  }
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
  const blocked = requireNonDemo(user.email);
  if (blocked) return { ok: false, error: blocked };
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
  // Archiving hides a note from the showcase (a soft-delete); block it for the
  // shared demo account just like the hard deletes, so the showcase stays intact.
  const blocked = requireNonDemo(user.email);
  if (blocked) return { ok: false, error: blocked };
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
  const blocked = requireNonDemo(user.email);
  if (blocked) return { ok: false, error: blocked };
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
