"use client";

import { useState, useTransition, type ReactNode } from "react";
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
  /** Runs after a successful action, before the router refresh. */
  onSuccess?: () => void;
  /**
   * Custom trigger element. Defaults to a ghost trash-icon button. Pass a
   * labeled button to reuse this dialog for non-delete destructive actions.
   */
  trigger?: ReactNode;
  /** Confirm button label (default "Delete") and its pending label. */
  confirmLabel?: string;
  confirmingLabel?: string;
}

/**
 * Reusable destructive-confirm dialog. Used for admin-table deletes (default
 * trash trigger) and any other destructive action via the `trigger`/label props
 * — so destructive confirms share one tested modal instead of bespoke
 * two-click/onBlur affordances.
 */
export function ConfirmDelete({
  action,
  title,
  description,
  onSuccess,
  trigger,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting…",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Don't let the dialog close mid-action (backdrop/Esc/Cancel).
        if (!pending) setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
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
            loadingText={confirmingLabel}
            onClick={() =>
              start(async () => {
                const res = await action();
                if (res.ok) {
                  setOpen(false);
                  onSuccess?.();
                  router.refresh();
                } else {
                  setError(res.error ?? "Action failed.");
                }
              })
            }
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
