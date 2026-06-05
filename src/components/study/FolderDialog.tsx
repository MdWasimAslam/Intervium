"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFolder, moveFolder, renameFolder } from "@/lib/actions/study";
import { flattenForSelect, wouldCreateCycle } from "@/lib/study/tree";
import type { FolderInput } from "@/lib/study/types";

const ROOT = "__root__";

type Mode =
  | { kind: "create"; parentId: string | null }
  | { kind: "edit"; id: string; name: string; parentId: string | null };

export function FolderDialog({
  folders,
  mode,
  trigger,
}: {
  folders: FolderInput[];
  mode: Mode;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(mode.kind === "edit" ? mode.name : "");
  const [parentId, setParentId] = useState<string | null>(mode.parentId);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  // When editing, a folder can't be moved under itself or a descendant.
  const options = flattenForSelect(folders).filter((o) =>
    mode.kind === "edit"
      ? !wouldCreateCycle(folders, mode.id, o.id) && o.id !== mode.id
      : true,
  );

  function reset() {
    setName(mode.kind === "edit" ? mode.name : "");
    setParentId(mode.parentId);
    setError(undefined);
  }

  function submit() {
    setError(undefined);
    start(async () => {
      if (mode.kind === "create") {
        const res = await createFolder({ name, parentId });
        if (!res.ok) return setError(res.error);
      } else {
        const renamed = await renameFolder({ id: mode.id, name });
        if (!renamed.ok) return setError(renamed.error);
        if (parentId !== mode.parentId) {
          const moved = await moveFolder({ id: mode.id, parentId });
          if (!moved.ok) return setError(moved.error);
        }
      }
      setOpen(false);
      router.refresh();
    });
  }

  const title = mode.kind === "create" ? "New folder" : "Edit folder";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              autoFocus
              maxLength={120}
              placeholder="e.g. JavaScript"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) submit();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Parent folder</Label>
            <Select
              value={parentId ?? ROOT}
              onValueChange={(v) => setParentId(v === ROOT ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT}>None (top level)</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {" ".repeat(o.depth * 2)}
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={pending}
              disabled={!name.trim()}
              onClick={submit}
            >
              {mode.kind === "create" ? "Create" : "Save"}
            </LoadingButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
