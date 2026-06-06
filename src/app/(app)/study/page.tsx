import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { requireAuth } from "@/lib/session";
import {
  countDueFlashcards,
  countNotes,
  listAllTags,
  listFolders,
  listNotes,
  listRecentlyViewed,
  type ListNotesOpts,
} from "@/lib/study/queries";
import { StudyHome } from "@/components/study/StudyHome";
import type { FolderSelection } from "@/components/study/FolderTree";

export const metadata: Metadata = { title: "Study Notes" };

const PAGE_SIZE = 30;

/**
 * /study — personal knowledge base. A folder-tree sidebar plus a notes list
 * filtered by the active folder (optionally its whole subtree), a tag, and/or a
 * search query, all driven by `searchParams`.
 */
export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim();

  const folderParam = first(sp.folder);
  const tag = first(sp.tag) || null;
  const query = first(sp.q) ?? "";
  // Subfolders are excluded by default; only `sub=1` opts a folder's subtree in.
  const includeSubfolders = first(sp.sub) === "1";
  const page = Math.max(1, Number(first(sp.page)) || 1);
  // A bare /study (no folder param at all) means "restore my last folder":
  // every in-app view carries an explicit folder param, so the absence of one
  // signals an external/fresh landing where StudyHome should jump back.
  const autoRestore = !folderParam;

  const selection: FolderSelection =
    !folderParam || folderParam === "all"
      ? "all"
      : folderParam === "unfiled"
        ? "unfiled"
        : folderParam;

  const noteOpts: ListNotesOpts = {
    tag: tag ?? undefined,
    q: query || undefined,
  };
  if (selection === "unfiled") noteOpts.folderId = null;
  else if (selection !== "all") {
    noteOpts.folderId = selection;
    noteOpts.includeSubfolders = includeSubfolders;
  }

  // Two DB phases. Phase 1 runs everything that doesn't depend on the page
  // offset in parallel — including the folder tree (needed for the sidebar) and
  // the total count (needed to clamp the page). Phase 2 fetches just the
  // requested page, reusing the folders from phase 1 so `listNotes` never
  // re-reads the folder table to resolve a subfolder filter.
  const [folders, totalNotes, allTags, dueCount, recentlyViewed] =
    await Promise.all([
      listFolders(user.id),
      countNotes(user.id, noteOpts),
      listAllTags(user.id),
      countDueFlashcards(user.id),
      listRecentlyViewed(user.id),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalNotes / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  noteOpts.folders = folders;
  noteOpts.limit = PAGE_SIZE;
  noteOpts.offset = (safePage - 1) * PAGE_SIZE;

  const notes = await listNotes(user.id, noteOpts);

  return (
    <Container className="py-10 sm:py-12">
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Study Notes
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Capture what you learn, organize it into folders, and revise with
            spaced-repetition flashcards.
          </p>
        </header>

        <StudyHome
          folders={folders}
          notes={notes}
          allTags={allTags}
          dueCount={dueCount}
          recentlyViewed={recentlyViewed}
          selection={selection}
          activeTag={tag}
          query={query}
          includeSubfolders={includeSubfolders}
          page={safePage}
          totalPages={totalPages}
          autoRestore={autoRestore}
        />
      </div>
    </Container>
  );
}
