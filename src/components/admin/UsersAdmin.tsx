"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, KeyRound, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
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
  DialogClose,
  DialogContent,
  DialogDescription,
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
import {
  changeUserPassword,
  createUser,
  resetUserAccountData,
  setUserActive,
  updateUser,
} from "@/lib/actions/admin/users";

export interface UserRow {
  id: string;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  displayName: string | null;
  yearsExperience: number | null;
  primaryRole: string | null;
}
export interface SessionRow {
  id: string;
  userId: string;
  role: string;
  interviewType: string;
  totalScore: number;
  maxScore: number;
  status: string;
  startedAt: string;
}

export function UsersAdmin({
  users,
  sessions,
}: {
  users: UserRow[];
  sessions: SessionRow[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Deactivated users can&apos;t log in.
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
                  <HistoryDialog
                    email={u.email}
                    sessions={sessions.filter((s) => s.userId === u.id)}
                  />
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HistoryDialog({
  email,
  sessions,
}: {
  email: string;
  sessions: SessionRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Session history">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sessions · {email}</DialogTitle>
        </DialogHeader>
        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No interview sessions yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role / Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">
                    {s.role} · {s.interviewType}
                  </TableCell>
                  <TableCell className="text-xs">{s.status}</TableCell>
                  <TableCell className="text-sm">
                    {s.status === "completed"
                      ? `${s.totalScore}/${s.maxScore}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--muted-foreground)]">
                    {s.startedAt.slice(0, 10)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Create or edit a user. With no `user` it creates (email + password + role);
 * with a `user` it edits core fields and basic profile (password is handled
 * separately via PasswordDialog).
 */
function UserFormDialog({
  user,
  trigger,
}: {
  user?: UserRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">(user?.role ?? "user");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [years, setYears] = useState(user?.yearsExperience ?? 0);

  function submit() {
    setError(undefined);
    start(async () => {
      const res = user
        ? await updateUser({
            id: user.id,
            email,
            role,
            displayName,
            yearsExperience: years,
          })
        : await createUser({ email, password, role, displayName });
      if (res.ok) {
        setOpen(false);
        if (!user) setPassword("");
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
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          {!user && (
            <div className="space-y-1.5">
              <Label htmlFor="u-password">Password</Label>
              <Input
                id="u-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Display name</Label>
            <Input
              id="u-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Defaults to the email handle"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "user" | "admin")}
              >
                <SelectTrigger id="u-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user && (
              <div className="space-y-1.5">
                <Label htmlFor="u-years">Years experience</Label>
                <Input
                  id="u-years"
                  type="number"
                  min={0}
                  max={60}
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {user ? "Save changes" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admin-initiated password reset for any user. */
function PasswordDialog({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await changeUserPassword({ id: userId, password });
      if (res.ok) {
        setOpen(false);
        setPassword("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Reset password">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {email}. They&apos;ll use it on their next
            login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="p-password">New password</Label>
          <Input
            id="p-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <FormError message={error} />}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending}>
            Update password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetAccountDialog({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          aria-label="Reset account data"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset account data</DialogTitle>
          <DialogDescription>
            This permanently deletes {email}&apos;s profile, CV, onboarding and
            every interview session with its answers and feedback. The login
            stays active and the user starts fresh from onboarding. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <FormError message={error} />}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="outline"
            className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await resetUserAccountData({ id: userId });
                if (res.ok) {
                  setOpen(false);
                  router.refresh();
                } else {
                  setError(res.error ?? "Reset failed.");
                }
              })
            }
          >
            Reset account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
