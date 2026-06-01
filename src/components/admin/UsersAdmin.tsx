"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setUserActive } from "@/lib/actions/admin/users";
import { HistoryDialog } from "@/components/admin/users/HistoryDialog";
import { UserFormDialog } from "@/components/admin/users/UserFormDialog";
import { PasswordDialog } from "@/components/admin/users/PasswordDialog";
import { ResetAccountDialog } from "@/components/admin/users/ResetAccountDialog";
import { DeleteUserDialog } from "@/components/admin/users/DeleteUserDialog";

export interface UserRow {
  id: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  displayName: string | null;
  yearsExperience: number | null;
  primaryRole: string | null;
}
export function UsersAdmin({
  users,
  page,
  totalPages,
  total,
}: {
  users: UserRow[];
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  function goToPage(p: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {total} user{total === 1 ? "" : "s"}. Deactivated users can&apos;t
            log in.
          </p>
        </div>
        <UserFormDialog
          trigger={
            <Button>
              <Plus /> Add user
            </Button>
          }
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Profile</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    seed={u.id}
                    size={28}
                    alt={`Avatar for ${u.email}`}
                    className="shrink-0"
                  />
                  {u.email}
                </div>
              </TableCell>
              <TableCell>
                <Chip>{u.role}</Chip>
              </TableCell>
              <TableCell className="text-xs text-[var(--muted-foreground)]">
                {u.primaryRole ?? "—"}
                {u.yearsExperience !== null ? ` · ${u.yearsExperience}y` : ""}
              </TableCell>
              <TableCell>
                <Switch
                  checked={u.isActive}
                  aria-label="Toggle active"
                  onCheckedChange={(v) =>
                    start(async () => {
                      await setUserActive({ id: u.id, isActive: v });
                      router.refresh();
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <HistoryDialog email={u.email} userId={u.id} />
                  <UserFormDialog
                    user={u}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label="Edit user">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <PasswordDialog email={u.email} userId={u.id} />
                  <ResetAccountDialog email={u.email} userId={u.id} />
                  {u.role !== "admin" && (
                    <DeleteUserDialog email={u.email} userId={u.id} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination ------------------------------------------------------- */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
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
  );
}
