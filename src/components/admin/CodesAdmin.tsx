"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Mail,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { FormError } from "@/components/auth/FormError";
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
  deleteCode,
  generateCodes,
  sendDemoInviteAction,
} from "@/lib/actions/admin/codes";

export interface CodeRow {
  id: string;
  code: string;
  isUsed: boolean;
  usedByEmail: string | null;
  expiresAt: string | null;
}

export function CodesAdmin({
  codes,
  page,
  totalPages,
  total,
}: {
  codes: CodeRow[];
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();

  function goToPage(p: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Access Codes</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {total} code{total === 1 ? "" : "s"}. Registration requires a valid,
            unused code.
          </p>
        </div>
        <div className="flex gap-2">
          <InviteDialog />
          <GenerateDialog />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Used by</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono">{c.code}</TableCell>
              <TableCell>
                {c.isUsed ? (
                  <Chip tone="neutral">Used</Chip>
                ) : (
                  <Chip tone="success">Unused</Chip>
                )}
              </TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {c.usedByEmail ?? "—"}
              </TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {c.expiresAt ? c.expiresAt.slice(0, 10) : "Never"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <CopyButton code={c.code} />
                  {!c.isUsed && (
                    <ConfirmDelete
                      title={`Delete ${c.code}?`}
                      action={() => deleteCode({ id: c.id })}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {codes.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-[var(--muted-foreground)]"
              >
                No codes yet. Generate some.
              </TableCell>
            </TableRow>
          )}
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

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Copy code"
      onClick={() => {
        navigator.clipboard?.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? (
        <Check className="h-4 w-4 text-[var(--primary)]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await sendDemoInviteAction({ email });
      if (res.ok) {
        setSent(true);
        setEmail("");
      } else setError(res.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSent(false);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="h-4 w-4" /> Email demo invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email demo access</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Sends the shared demo account&apos;s email, password, and sign-in
            link to this address.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Recipient email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              placeholder="someone@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <FormError message={error} />}
          {sent && (
            <p className="text-sm font-medium text-[var(--primary)]">
              Invite sent ✓
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !email.trim()}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [count, setCount] = useState(5);
  const [expiresInDays, setExpiresInDays] = useState(0);

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await generateCodes({
        count,
        expiresInDays: expiresInDays || undefined,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Generate codes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate access codes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-count">How many? (1–100)</Label>
            <Input
              id="c-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-exp">Expires in (days, 0 = never)</Label>
            <Input
              id="c-exp"
              type="number"
              min={0}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
            />
          </div>
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
