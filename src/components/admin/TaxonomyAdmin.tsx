"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/chip";
import { FormError } from "@/components/auth/FormError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import {
  createFocus,
  createTech,
  deleteFocus,
  deleteTech,
  updateFocus,
  updateTech,
} from "@/lib/actions/admin/taxonomy";
import type { AdminResult } from "@/lib/actions/admin/util";

export interface TaxonomyItem {
  id: string;
  jobRoleId: string;
  name: string;
  isActive: boolean;
}
export interface RoleRef {
  id: string;
  name: string;
}

interface Props {
  kind: "focus" | "tech";
  title: string;
  description: string;
  roles: RoleRef[];
  items: TaxonomyItem[];
}

const ACTIONS = {
  focus: { create: createFocus, update: updateFocus, remove: deleteFocus },
  tech: { create: createTech, update: updateTech, remove: deleteTech },
};

export function TaxonomyAdmin({
  kind,
  title,
  description,
  roles,
  items,
}: Props) {
  const actions = ACTIONS[kind];
  const [filter, setFilter] = useState<string>("all");

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const visible = useMemo(
    () =>
      filter === "all" ? items : items.filter((i) => i.jobRoleId === filter),
    [items, filter],
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
        <ItemDialog
          kind={kind}
          roles={roles}
          create={actions.create}
          update={actions.update}
          trigger={
            <Button>
              <Plus /> Add
            </Button>
          }
        />
      </div>

      <div className="mb-4 w-56">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {roleName(item.jobRoleId)}
              </TableCell>
              <TableCell>
                {item.isActive ? (
                  <Chip tone="success">Active</Chip>
                ) : (
                  <Chip tone="neutral">Inactive</Chip>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <ItemDialog
                    kind={kind}
                    roles={roles}
                    item={item}
                    create={actions.create}
                    update={actions.update}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    title={`Delete "${item.name}"?`}
                    action={() => actions.remove({ id: item.id })}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-[var(--muted-foreground)]"
              >
                Nothing here yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ItemDialog({
  kind,
  roles,
  item,
  create,
  update,
  trigger,
}: {
  kind: "focus" | "tech";
  roles: RoleRef[];
  item?: TaxonomyItem;
  create: (i: unknown) => Promise<AdminResult>;
  update: (i: unknown) => Promise<AdminResult>;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const [name, setName] = useState(item?.name ?? "");
  const [jobRoleId, setJobRoleId] = useState(
    item?.jobRoleId ?? roles[0]?.id ?? "",
  );
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  function submit() {
    setError(undefined);
    start(async () => {
      const payload = { name, jobRoleId, isActive };
      const res = item
        ? await update({ id: item.id, ...payload })
        : await create(payload);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit" : "Add"}{" "}
            {kind === "focus" ? "focus area" : "tech stack"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Name</Label>
            <Input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={jobRoleId} onValueChange={setJobRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm">Active</span>
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {item ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
