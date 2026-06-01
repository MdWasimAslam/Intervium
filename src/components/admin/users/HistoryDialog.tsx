"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  getUserSessions,
  type AdminUserSession,
} from "@/lib/actions/admin/sessions";

function HistoryDialog({ email, userId }: { email: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AdminUserSession[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Load the user's sessions lazily, only when the dialog first opens.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && sessions === null && !loading) {
      setLoading(true);
      getUserSessions(userId)
        .then((rows) => setSessions(rows))
        .catch(() => setSessions([]))
        .finally(() => setLoading(false));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Session history">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sessions · {email}</DialogTitle>
        </DialogHeader>
        {loading || sessions === null ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
        ) : sessions.length === 0 ? (
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
                    {s.role} · {s.mode}
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

export { HistoryDialog };
