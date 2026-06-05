import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { requireAuth } from "@/lib/session";
import {
  countDueFlashcards,
  listAllTags,
  listFolders,
  listNotes,
  listRecentlyViewed,
  type ListNotesOpts,
} from "@/lib/study/queries";
import { StudyHome } from "@/components/study/StudyHome";
import type { FolderSelection } from "@/components/study/FolderTree";

export const metadata: Metadata = { title: "Study Notes" };

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
  const includeSubfolders = first(sp.sub) !== "0";

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

  const [folders, notes, allTags, dueCount, recentlyViewed] = await Promise.all(
    [
      listFolders(user.id),
      listNotes(user.id, noteOpts),
      listAllTags(user.id),
      countDueFlashcards(user.id),
      listRecentlyViewed(user.id),
    ],
  );

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
        />
      </div>
    </Container>
  );
}
