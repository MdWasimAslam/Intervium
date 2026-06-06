"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/label";
import { folderPath } from "@/lib/study/tree";
import type { FolderInput, StudyNoteRow } from "@/lib/study/types";
import { ExportDialog } from "./ExportDialog";
import { FolderTree, type FolderSelection } from "./FolderTree";
import { NoteDialog } from "./NoteDialog";
import { NotesList } from "./NotesList";

export interface StudyHomeProps {
  folders: FolderInput[];
  notes: StudyNoteRow[];
  allTags: string[];
  dueCount: number;
  recentlyViewed: StudyNoteRow[];
  selection: FolderSelection;
  activeTag: string | null;
  query: string;
  includeSubfolders: boolean;
  page: number;
  totalPages: number;
  /** True on a bare /study (no folder param) — restore the last-open folder. */
  autoRestore: boolean;
}

const LAST_FOLDER_KEY = "study:lastFolder";

export function StudyHome({
  folders,
  notes,
  allTags,
  dueCount,
  recentlyViewed,
  selection,
  activeTag,
  query,
  includeSubfolders,
  page,
  totalPages,
  autoRestore,
}: StudyHomeProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query);

  // Remember the last explicit folder view so a bare /study can return to it.
  useEffect(() => {
    if (autoRestore) return; // don't overwrite the memory while restoring
    try {
      window.localStorage.setItem(
        LAST_FOLDER_KEY,
        JSON.stringify({ folder: selection, sub: includeSubfolders }),
      );
    } catch {
      /* localStorage unavailable (private mode etc.) — non-fatal */
    }
  }, [autoRestore, selection, includeSubfolders]);

  // Landed on a bare /study → jump back to the remembered folder, if still valid.
  useEffect(() => {
    if (!autoRestore) return;
    let stored: { folder?: string; sub?: boolean } | null = null;
    try {
      stored = JSON.parse(
        window.localStorage.getItem(LAST_FOLDER_KEY) ?? "null",
      );
    } catch {
      /* ignore malformed/unavailable storage */
    }
    const folder = stored?.folder;
    if (!folder || folder === "all") return; // nothing to restore (already All)
    // Only restore real targets: "unfiled", or a folder that still exists.
    if (folder !== "unfiled" && !folders.some((f) => f.id === folder)) return;
    const params = new URLSearchParams({ folder });
    if (stored?.sub && folder !== "unfiled") params.set("sub", "1");
    router.replace(`/study?${params.toString()}`);
  }, [autoRestore, folders, router]);

  const isFolder = selection !== "all" && selection !== "unfiled";
  const crumbs = isFolder ? folderPath(folders, selection) : [];
  const hasFilters = Boolean(activeTag) || Boolean(query);
  const showRecent =
    selection === "all" && !hasFilters && recentlyViewed.length > 0;

  /**
   * Build a `/study` URL, merging the current filters with `patch`. `page` is
   * only carried when explicitly patched (Prev/Next), so any filter change
   * naturally resets to page 1.
   */
  function hrefWith(patch: {
    folder?: FolderSelection | null;
    tag?: string | null;
    q?: string | null;
    sub?: boolean | null;
    page?: number;
  }): string {
    const params = new URLSearchParams();
    const folder = patch.folder !== undefined ? patch.folder : selection;
    // Always emit the folder (including "all") so in-app URLs are never bare —
    // a bare /study is reserved for the last-folder restore.
    if (folder) params.set("folder", folder);

    const tag = patch.tag !== undefined ? patch.tag : activeTag;
    if (tag) params.set("tag", tag);

    const q = patch.q !== undefined ? patch.q : query;
    if (q) params.set("q", q);

    // Subfolders are excluded by default; the param is only present when ON.
    const sub = patch.sub !== undefined ? patch.sub : includeSubfolders;
    if (isFolder && sub === true) params.set("sub", "1");

    if (patch.page && patch.page > 1) params.set("page", String(patch.page));

    const qs = params.toString();
    return qs ? `/study?${qs}` : "/study";
  }

  function runSearch() {
    router.push(hrefWith({ q: search.trim() || null }));
  }

  function goToPage(p: number) {
    router.push(hrefWith({ page: p }));
  }

  const defaultFolderId = isFolder ? selection : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <FolderTree folders={folders} selected={selection} />
      </aside>

      {/* Main pane */}
      <div className="min-w-0 space-y-5">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 text-sm text-[var(--muted-foreground)]">
          <Link
            href="/study?folder=all"
            className="hover:text-[var(--foreground)]"
          >
            All notes
          </Link>
          {selection === "unfiled" && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[var(--foreground)]">Unfiled</span>
            </>
          )}
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" />
              {i === crumbs.length - 1 ? (
                <span className="text-[var(--foreground)]">{c.name}</span>
              ) : (
                <Link
                  href={hrefWith({ folder: c.id })}
                  className="hover:text-[var(--foreground)]"
                >
                  {c.name}
                </Link>
              )}
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              value={search}
              placeholder="Search notes…"
              className="pl-9"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
          </div>
          <Button variant="outline" onClick={runSearch}>
            Search
          </Button>
          <ExportDialog
            filter={{
              folderId:
                selection === "all"
                  ? undefined
                  : selection === "unfiled"
                    ? null
                    : selection,
              includeSubfolders: isFolder ? includeSubfolders : undefined,
              tag: activeTag ?? undefined,
              q: query || undefined,
            }}
            trigger={
              <Button variant="outline" disabled={notes.length === 0}>
                <Download className="h-4 w-4" /> Export
              </Button>
            }
          />
          <NoteDialog
            folders={folders}
            allTags={allTags}
            defaultFolderId={defaultFolderId}
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> New note
              </Button>
            }
          />
        </div>

        {/* Subfolder toggle */}
        {isFolder && (
          <label className="flex w-fit items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Switch
              checked={includeSubfolders}
              onCheckedChange={(v) =>
                router.push(hrefWith({ sub: v ? true : null }))
              }
            />
            Include subfolders
          </label>
        )}

        {/* Active filter pills */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {activeTag && (
              <FilterPill
                label={`#${activeTag}`}
                href={hrefWith({ tag: null })}
              />
            )}
            {query && (
              <FilterPill
                label={`“${query}”`}
                href={hrefWith({ q: null })}
                onClear={() => setSearch("")}
              />
            )}
          </div>
        )}

        {/* Continue studying */}
        {dueCount > 0 && (
          <Link
            href="/study/review"
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/[0.06] px-4 py-3 transition-colors hover:bg-[var(--primary)]/10"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
              Continue studying — {dueCount} card
              {dueCount === 1 ? "" : "s"} due
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">
              Review now <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}

        {/* Recently viewed */}
        {showRecent && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              <Clock className="h-3.5 w-3.5" /> Recently viewed
            </p>
            <div className="flex flex-wrap gap-2">
              {recentlyViewed.map((n) => (
                <Link
                  key={n.id}
                  href={hrefWith({ q: n.title })}
                  className="max-w-[14rem] truncate rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm hover:border-[var(--border-strong)]"
                >
                  {n.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <Link
                key={t}
                href={hrefWith({ tag: activeTag === t ? null : t })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  activeTag === t
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border-strong)]",
                )}
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        {/* Notes */}
        {notes.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No matching notes" : "No notes yet"}
            description={
              hasFilters
                ? "Try clearing a filter or searching for something else."
                : "Create your first note or flashcard to start your study library."
            }
            action={
              !hasFilters ? (
                <NoteDialog
                  folders={folders}
                  allTags={allTags}
                  defaultFolderId={defaultFolderId}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4" /> New note
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        ) : (
          <NotesList notes={notes} folders={folders} allTags={allTags} />
        )}

        {/* Pagination ----------------------------------------------------- */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  href,
  onClear,
}: {
  label: string;
  href: string;
  onClear?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-medium"
    >
      {label}
      <X className="h-3 w-3" />
    </Link>
  );
}
