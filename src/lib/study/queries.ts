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
      createdAt: studyFolders.createdAt,
    })
    .from(studyFolders)
    .where(eq(studyFolders.userId, userId))
    .orderBy(studyFolders.sortOrder, studyFolders.createdAt);
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
  /** Page size — when set, only this many rows are returned. */
  limit?: number;
  /** Row offset for the current page (used with `limit`). */
  offset?: number;
  /**
   * Pre-fetched folder list, used to resolve `includeSubfolders` descendants
   * without re-querying. Pass this when the caller already has the folders
   * (e.g. the page that also renders the tree) so a single render doesn't read
   * the folder table once per `listNotes`/`countNotes` call.
   */
  folders?: FolderInput[];
}

/**
 * The filter clauses shared by {@link listNotes} and {@link countNotes}, so the
 * paginated page query and its total count always agree on what's included.
 * Async because the subfolder option needs the folder tree to resolve descendants.
 */
async function noteClauses(
  userId: string,
  opts: ListNotesOpts,
): Promise<(SQL | undefined)[]> {
  const clauses: (SQL | undefined)[] = [eq(studyNotes.userId, userId)];

  if (!opts.includeArchived) clauses.push(eq(studyNotes.isArchived, false));

  if (opts.folderId === null) {
    clauses.push(isNull(studyNotes.folderId));
  } else if (typeof opts.folderId === "string") {
    if (opts.includeSubfolders) {
      const folders = opts.folders ?? (await listFolders(userId));
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

  return clauses;
}

/**
 * The user's notes for the list view: pinned first, then most-recently-created.
 * Folder filtering optionally spans the whole subtree; tag/text filters and the
 * note/flashcard split are all applied server-side. Pass `limit`/`offset` to
 * page the result (the list view always does, to stay bounded as notes grow).
 */
export async function listNotes(
  userId: string,
  opts: ListNotesOpts = {},
): Promise<StudyNoteRow[]> {
  const clauses = await noteClauses(userId, opts);

  let query = db
    .select()
    .from(studyNotes)
    .where(and(...clauses))
    // Pinned first, then newest first (by creation) so freshly added/imported
    // notes surface at the top and stay put when older notes are edited.
    .orderBy(desc(studyNotes.isPinned), desc(studyNotes.createdAt))
    .$dynamic();

  if (opts.limit != null) query = query.limit(opts.limit);
  if (opts.offset != null) query = query.offset(opts.offset);

  return query;
}

/** Total notes matching the same filters as {@link listNotes} (for paging). */
export async function countNotes(
  userId: string,
  opts: ListNotesOpts = {},
): Promise<number> {
  const clauses = await noteClauses(userId, opts);
  return db.$count(studyNotes, and(...clauses));
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
  // Aggregate in SQL — sizing a badge shouldn't ship every due-card id over the
  // wire just to take `.length` (matches the `db.$count` used by countNotes).
  return db.$count(studyNotes, dueClause(userId));
}

/**
 * Cap on cards pulled into a single review session — far beyond a realistic
 * sitting, so the batch query stays bounded however large the due queue grows.
 */
const REVIEW_BATCH_LIMIT = 200;

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
      .limit(REVIEW_BATCH_LIMIT)
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
