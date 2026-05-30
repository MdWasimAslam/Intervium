"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

/** Reusable destructive confirm dialog used across admin tables. */
export function ConfirmDelete({ action, title, description }: Props) {
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
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="outline"
            className="border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await action();
                if (res.ok) {
                  setOpen(false);
                  router.refresh();
                } else {
                  setError(res.error ?? "Delete failed.");
                }
              })
            }
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
