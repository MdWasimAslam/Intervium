"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createBand,
  deleteBand,
  updateBand,
} from "@/lib/actions/admin/difficulty";
import type { RoleRef } from "@/components/admin/TaxonomyAdmin";

export interface Band {
  id: string;
  jobRoleId: string;
  label: string;
  minYears: number | null;
  maxYears: number | null;
}

export function DifficultyAdmin({
  roles,
  bands,
}: {
  roles: RoleRef[];
  bands: Band[];
}) {
  const [filter, setFilter] = useState(roles[0]?.id ?? "all");
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const visible = useMemo(
    () =>
      (filter === "all" ? bands : bands.filter((b) => b.jobRoleId === filter))
        .slice()
        .sort((a, b) => (a.minYears ?? 0) - (b.minYears ?? 0)),
    [bands, filter],
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Difficulty Bands</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Map years of experience to a difficulty. Ranges can&apos;t overlap
            within a role.
          </p>
        </div>
        <BandDialog
          roles={roles}
          defaultRole={filter !== "all" ? filter : roles[0]?.id}
          trigger={
            <Button>
              <Plus /> Add band
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
            <TableHead>Label</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Years</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.label}</TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {roleName(b.jobRoleId)}
              </TableCell>
              <TableCell>
                {b.minYears}–{b.maxYears}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <BandDialog
                    roles={roles}
                    band={b}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    title={`Delete "${b.label}"?`}
                    action={() => deleteBand({ id: b.id })}
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
                No bands yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function BandDialog({
  roles,
  band,
  defaultRole,
  trigger,
}: {
  roles: RoleRef[];
  band?: Band;
  defaultRole?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const [jobRoleId, setJobRoleId] = useState(
    band?.jobRoleId ?? defaultRole ?? roles[0]?.id ?? "",
  );
  const [label, setLabel] = useState(band?.label ?? "");
  const [minYears, setMinYears] = useState(band?.minYears ?? 0);
  const [maxYears, setMaxYears] = useState(band?.maxYears ?? 0);

  function submit() {
    setError(undefined);
    start(async () => {
      const payload = { jobRoleId, label, minYears, maxYears };
      const res = band
        ? await updateBand({ id: band.id, ...payload })
        : await createBand(payload);
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
          <DialogTitle>{band ? "Edit band" : "Add band"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <div className="space-y-1.5">
            <Label htmlFor="b-label">Label</Label>
            <Input
              id="b-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Mid"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-min">Min years</Label>
              <Input
                id="b-min"
                type="number"
                value={minYears}
                onChange={(e) => setMinYears(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-max">Max years</Label>
              <Input
                id="b-max"
                type="number"
                value={maxYears}
                onChange={(e) => setMaxYears(Number(e.target.value))}
              />
            </div>
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {band ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
