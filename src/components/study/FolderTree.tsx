"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Folder,
  FolderPlus,
  Inbox,
  Layers,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteFolder } from "@/lib/actions/study";
import { buildTree } from "@/lib/study/tree";
import type { FolderInput, FolderNode } from "@/lib/study/types";
import { FolderDialog } from "./FolderDialog";

/** The current folder view, mirrored to the `?folder=` query param. */
export type FolderSelection = string | "all" | "unfiled";

export function FolderTree({
  folders,
  selected,
}: {
  folders: FolderInput[];
  selected: FolderSelection;
}) {
  const tree = buildTree(folders);

  return (
    <nav className="space-y-1 text-sm">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Folders
        </span>
        <FolderDialog
          folders={folders}
          mode={{ kind: "create", parentId: null }}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="New folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          }
        />
      </div>

      <PseudoLink
        href="/study?folder=all"
        active={selected === "all"}
        icon={<Layers className="h-4 w-4" />}
        label="All notes"
      />
      <PseudoLink
        href="/study?folder=unfiled"
        active={selected === "unfiled"}
        icon={<Inbox className="h-4 w-4" />}
        label="Unfiled"
      />

      <div className="pt-1">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            folders={folders}
            selected={selected}
            depth={0}
          />
        ))}
      </div>
    </nav>
  );
}

function PseudoLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active
          ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)]"
          : "hover:bg-[var(--surface-hover)]",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function TreeNode({
  node,
  folders,
  selected,
  depth,
}: {
  node: FolderNode;
  folders: FolderInput[];
  selected: FolderSelection;
  depth: number;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const active = selected === node.id;
  const hasChildren = node.children.length > 0;

  function remove() {
    start(async () => {
      const res = await deleteFolder({ id: node.id });
      setConfirming(false);
      if (res.ok) {
        if (active) router.push("/study?folder=all");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 transition-colors",
          active
            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
            : "hover:bg-[var(--surface-hover)]",
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)]",
            !hasChildren && "invisible",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/study?folder=${node.id}`)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left",
            active ? "font-medium" : "",
          )}
        >
          <Folder className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{node.name}</span>
        </button>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <FolderDialog
            folders={folders}
            mode={{ kind: "create", parentId: node.id }}
            trigger={
              <button
                type="button"
                title="New subfolder"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
              </button>
            }
          />
          <FolderDialog
            folders={folders}
            mode={{
              kind: "edit",
              id: node.id,
              name: node.name,
              parentId: node.parentId,
            }}
            trigger={
              <button
                type="button"
                title="Rename / move"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            }
          />
          <button
            type="button"
            title="Delete folder"
            disabled={pending}
            onClick={() => (confirming ? remove() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            className={cn(
              "flex h-6 items-center justify-center rounded px-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]",
              confirming && "text-[var(--destructive)]",
            )}
          >
            {confirming ? (
              <span className="text-xs font-medium">Sure?</span>
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            folders={folders}
            selected={selected}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
