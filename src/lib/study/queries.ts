import "server-only";
import {
  and,
  arrayContains,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, studyFolders, studyNotes } from "@db";
import { descendantIds } from "./tree";
import type { FolderInput, StudyNoteRow, StudyReviewCard } from "./types";

/** All of the user's folders as flat rows; callers build the tree in memory. */
export async function listFolders(userId: string): Promise<FolderInput[]> {
  return db
    .select({
      id: studyFolders.id,
      name: studyFolders.name,
      parentId: studyFolders.parentId,
      sortOrder: studyFolders.sortOrder,
    })
    .from(studyFolders)
    .where(eq(studyFolders.userId, userId))
    .orderBy(studyFolders.sortOrder, studyFolders.name);
}

/** One note in full, scoped to the owner. Null if missing or not theirs. */
export async function getNote(
  userId: string,
  id: string,
): Promise<StudyNoteRow | null> {
  const [row] = await db
    .select()
    .from(studyNotes)
    .where(and(eq(studyNotes.id, id), eq(studyNotes.userId, userId)));
  return row ?? null;
}

export interface ListNotesOpts {
  /** A folder id, or `null` for "unfiled", or omit for "all folders". */
  folderId?: string | null;
  /** When a folder id is given, also include notes in its descendant folders. */
  includeSubfolders?: boolean;
  tag?: string;
  q?: string;
  kind?: "note" | "flashcard";
  includeArchived?: boolean;
}

/**
 * The user's notes for the list view: pinned first, then most-recently-updated.
 * Folder filtering optionally spans the whole subtree; tag/text filters and the
 * note/flashcard split are all applied server-side.
 */
export async function listNotes(
  userId: string,
  opts: ListNotesOpts = {},
): Promise<StudyNoteRow[]> {
  const clauses: (SQL | undefined)[] = [eq(studyNotes.userId, userId)];

  if (!opts.includeArchived) clauses.push(eq(studyNotes.isArchived, false));

  if (opts.folderId === null) {
    clauses.push(isNull(studyNotes.folderId));
  } else if (typeof opts.folderId === "string") {
    if (opts.includeSubfolders) {
      const folders = await listFolders(userId);
      const ids = descendantIds(folders, opts.folderId);
      clauses.push(inArray(studyNotes.folderId, ids));
    } else {
      clauses.push(eq(studyNotes.folderId, opts.folderId));
    }
  }

  if (opts.tag) clauses.push(arrayContains(studyNotes.tags, [opts.tag]));

  if (opts.kind === "flashcard") clauses.push(eq(studyNotes.isFlashcard, true));
  else if (opts.kind === "note")
    clauses.push(eq(studyNotes.isFlashcard, false));

  if (opts.q && opts.q.trim()) {
    const needle = `%${opts.q.trim()}%`;
    clauses.push(
      or(ilike(studyNotes.title, needle), ilike(studyNotes.content, needle)),
    );
  }

  return (
    db
      .select()
      .from(studyNotes)
      .where(and(...clauses))
      // Pinned first, then newest first (by creation) so freshly added/imported
      // notes surface at the top and stay put when older notes are edited.
      .orderBy(desc(studyNotes.isPinned), desc(studyNotes.createdAt))
  );
}

/** Distinct tags across the user's non-archived notes (for filter/autocomplete). */
export async function listAllTags(userId: string): Promise<string[]> {
  const rows = await db
    .select({ tags: studyNotes.tags })
    .from(studyNotes)
    .where(
      and(eq(studyNotes.userId, userId), eq(studyNotes.isArchived, false)),
    );
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** A flashcard is "due" when it's a non-archived card with no/past dueAt. */
function dueClause(userId: string): SQL {
  return and(
    eq(studyNotes.userId, userId),
    eq(studyNotes.isFlashcard, true),
    eq(studyNotes.isArchived, false),
    or(isNull(studyNotes.dueAt), lte(studyNotes.dueAt, new Date())),
  )!;
}

/** How many flashcards are currently due for review. */
export async function countDueFlashcards(userId: string): Promise<number> {
  const rows = await db
    .select({ id: studyNotes.id })
    .from(studyNotes)
    .where(dueClause(userId));
  return rows.length;
}

/**
 * Flashcards due for review — brand-new cards (dueAt NULL) first, then the
 * longest-overdue. Loaded as a batch into the review session.
 */
export async function listDueCards(userId: string): Promise<StudyReviewCard[]> {
  return (
    db
      .select({
        id: studyNotes.id,
        title: studyNotes.title,
        content: studyNotes.content,
      })
      .from(studyNotes)
      .where(dueClause(userId))
      // New cards (NULL dueAt) surface first, then oldest due date onward.
      .orderBy(sql`${studyNotes.dueAt} asc nulls first`)
  );
}

/** Most recently opened notes, for the "Continue / Recently viewed" strip. */
export async function listRecentlyViewed(
  userId: string,
  limit = 6,
): Promise<StudyNoteRow[]> {
  return db
    .select()
    .from(studyNotes)
    .where(
      and(
        eq(studyNotes.userId, userId),
        eq(studyNotes.isArchived, false),
        isNotNull(studyNotes.lastViewedAt),
      ),
    )
    .orderBy(desc(studyNotes.lastViewedAt))
    .limit(limit);
}
