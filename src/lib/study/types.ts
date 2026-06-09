import type { studyFolders, studyNotes } from "@db";
import type { Rating } from "@/lib/spaced-repetition";

/** Self-rating used by the study-note review flow (alias of the shared union). */
export type StudyRating = Rating;

/** Raw row shapes, inferred from the Drizzle schema (no hand-written dupes). */
export type StudyFolderRow = typeof studyFolders.$inferSelect;
export type StudyNoteRow = typeof studyNotes.$inferSelect;

/** Flat folder fields the tree helpers operate on. */
export interface FolderInput {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
}

/** A folder with its nested children, for the sidebar tree. */
export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
}

/** A folder flattened for a `<Select>` (depth drives indentation). */
export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

/** One breadcrumb segment. */
export interface FolderCrumb {
  id: string;
  name: string;
}

/** One flashcard for the spaced-repetition review session. */
export interface StudyReviewCard {
  id: string;
  /** The prompt shown first (a flashcard's "front"). */
  title: string;
  /** The answer revealed on flip (the "back"). */
  content: string | null;
}
