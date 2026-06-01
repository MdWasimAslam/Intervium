"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/auth/FormError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { createRole, deleteRole, updateRole } from "@/lib/actions/admin/roles";

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  professionType: "technical" | "hr" | "sales" | "marketing" | "other";
  isActive: boolean;
  sortOrder: number;
}

const PROFESSION_TYPES: { value: Role["professionType"]; label: string }[] = [
  { value: "technical", label: "Technical (coding)" },
  { value: "hr", label: "HR" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other (non-technical)" },
];

const typeLabel = (t: Role["professionType"]) =>
  PROFESSION_TYPES.find((p) => p.value === t)?.label ?? t;

export function RolesAdmin({ roles }: { roles: Role[] }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Professions</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Professions users can interview for. The type controls whether
            interviews use technical (coding) framing or domain-appropriate
            non-technical framing. Inactive professions are hidden from setup.
          </p>
        </div>
        <RoleDialog
          trigger={
            <Button>
              <Plus /> Add profession
            </Button>
          }
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {typeLabel(role.professionType)}
              </TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {role.slug}
              </TableCell>
              <TableCell>{role.sortOrder}</TableCell>
              <TableCell>
                {role.isActive ? (
                  <Chip tone="success">Active</Chip>
                ) : (
                  <Chip tone="neutral">Inactive</Chip>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <RoleDialog
                    role={role}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    title={`Delete "${role.name}"?`}
                    description="This can't be undone."
                    action={() => deleteRole({ id: role.id })}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {roles.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-[var(--muted-foreground)]"
              >
                No professions yet. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RoleDialog({
  role,
  trigger,
}: {
  role?: Role;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const [name, setName] = useState(role?.name ?? "");
  const [slug, setSlug] = useState(role?.slug ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [professionType, setProfessionType] = useState<Role["professionType"]>(
    role?.professionType ?? "technical",
  );
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(role?.sortOrder ?? 0);

  function submit() {
    setError(undefined);
    start(async () => {
      const payload = {
        name,
        slug,
        description,
        professionType,
        isActive,
        sortOrder,
      };
      const res = role
        ? await updateRole({ id: role.id, ...payload })
        : await createRole(payload);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {role ? "Edit profession" : "Add profession"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-name">Name</Label>
            <Input
              id="r-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HR"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={professionType}
              onValueChange={(v) =>
                setProfessionType(v as Role["professionType"])
              }
            >
              <SelectTrigger aria-label="Profession type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFESSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--muted-foreground)]">
              Technical professions get coding/tech-stack interviews; the others
              get domain-appropriate, non-technical questions and grading.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-slug">Slug</Label>
            <Input
              id="r-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. hr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-desc">Description</Label>
            <Textarea
              id="r-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-order">Sort order</Label>
              <Input
                id="r-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">Active</span>
            </div>
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {role ? "Save changes" : "Create profession"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
