"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus } from "lucide-react";
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
import { deleteCode, generateCodes } from "@/lib/actions/admin/codes";

export interface CodeRow {
  id: string;
  code: string;
  isUsed: boolean;
  usedByEmail: string | null;
  expiresAt: string | null;
}

export function CodesAdmin({ codes }: { codes: CodeRow[] }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Access Codes</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Registration requires a valid, unused code.
          </p>
        </div>
        <GenerateDialog />
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
