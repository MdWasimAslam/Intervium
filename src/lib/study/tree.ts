import type {
  FolderCrumb,
  FolderInput,
  FolderNode,
  FolderOption,
} from "./types";

/**
 * Pure folder-tree helpers (no DB, no React) for the Study Notes feature. The
 * folder set per user is tiny, so we load it whole and shape it in memory rather
 * than running recursive SQL. Kept standalone like `spaced-repetition.ts`.
 */

/** Sort siblings by sortOrder then name (stable, locale-aware). */
function bySortThenName(a: FolderInput, b: FolderInput): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/** Flat rows → nested `FolderNode[]`. Orphans (missing parent) surface at root. */
export function buildTree(folders: FolderInput[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const f of folders) {
    byId.set(f.id, {
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      children: [],
    });
  }

  const roots: FolderNode[] = [];
  const order = [...folders].sort(bySortThenName);
  for (const f of order) {
    const node = byId.get(f.id)!;
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * A folder id plus every descendant id (depth-first). Used to filter notes by
 * "this folder and everything under it" via `inArray(folderId, …)`.
 */
export function descendantIds(
  folders: FolderInput[],
  folderId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const arr = childrenByParent.get(f.parentId) ?? [];
    arr.push(f.id);
    childrenByParent.set(f.parentId, arr);
  }

  const ids: string[] = [];
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    ids.push(id);
    const kids = childrenByParent.get(id);
    if (kids) stack.push(...kids);
  }
  return ids;
}

/** Breadcrumb from root → the given folder (inclusive). Empty if not found. */
export function folderPath(
  folders: FolderInput[],
  folderId: string,
): FolderCrumb[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const crumbs: FolderCrumb[] = [];
  let current = byId.get(folderId);
  // Guard against a cyclic chain (shouldn't happen — actions reject cycles).
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    crumbs.unshift({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return crumbs;
}

/** Flatten the tree into indented options for a folder `<Select>`. */
export function flattenForSelect(folders: FolderInput[]): FolderOption[] {
  const tree = buildTree(folders);
  const out: FolderOption[] = [];
  const walk = (nodes: FolderNode[], depth: number) => {
    const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
    for (const n of sorted) {
      out.push({ id: n.id, name: n.name, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

/**
 * Would moving `folderId` under `newParentId` create a cycle? True if the new
 * parent is the folder itself or one of its descendants.
 */
export function wouldCreateCycle(
  folders: FolderInput[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === folderId) return true;
  return descendantIds(folders, folderId).includes(newParentId);
}
