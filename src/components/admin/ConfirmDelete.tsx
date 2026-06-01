"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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

interface Props {
  action: () => Promise<{ ok: boolean; error?: string }>;
  title: string;
  description?: string;
  /** Runs after a successful delete, before the router refresh. */
  onSuccess?: () => void;
}

/** Reusable destructive confirm dialog used across admin tables. */
export function ConfirmDelete({ action, title, description, onSuccess }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Don't let the dialog close mid-delete (backdrop/Esc/Cancel).
        if (!pending) setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {error && <FormError message={error} />}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            variant="outline"
            className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            loading={pending}
            loadingText="Deleting…"
            onClick={() =>
              start(async () => {
                const res = await action();
                if (res.ok) {
                  setOpen(false);
                  onSuccess?.();
                  router.refresh();
                } else {
                  setError(res.error ?? "Delete failed.");
                }
              })
            }
          >
            Delete
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
