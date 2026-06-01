"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
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
import { resetUserAccountData } from "@/lib/actions/admin/users";

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
            stays active and the user starts fresh from onboarding. This
            can&apos;t be undone.
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

export { ResetAccountDialog };
