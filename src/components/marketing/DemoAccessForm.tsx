"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Mail, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormError } from "@/components/auth/FormError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { requestDemoAccessAction } from "@/lib/actions/demo";

/** Repo to star — set NEXT_PUBLIC_GITHUB_REPO_URL; falls back to the repo. */
const REPO_URL =
  process.env.NEXT_PUBLIC_GITHUB_REPO_URL ||
  "https://github.com/MdWasimAslam/Intervium";

/**
 * Demo access via a star-then-email modal. Clicking "Get demo access" opens a
 * dialog that asks the visitor to star the repo first (a click-through soft
 * gate — the email step unlocks once they've opened the star page), then emails
 * the shared demo login. Access is granted regardless of an actual star; the
 * gate only routes everyone through the star button (we can't verify a star
 * without GitHub OAuth). Server-side gated by the admin "demo access" toggle.
 */
export function DemoAccessForm() {
  const [open, setOpen] = useState(false);
  const [starred, setStarred] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Re-arm the gate each time the modal opens.
      setStarred(false);
      setSent(false);
      setError(undefined);
    }
  }

  function openStarPage() {
    window.open(REPO_URL, "_blank", "noopener,noreferrer");
    setStarred(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const res = await requestDemoAccessAction({ email });
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Star className="h-4 w-4" /> Get demo access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Get instant demo access</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
              <Check className="h-4 w-4" />
              Check your inbox — we&apos;ve emailed your demo login.
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Thanks for the star — it means a lot. ⭐
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1 — star (click-through gate) */}
            <div className="space-y-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                A quick favor first — star the repo on GitHub (it really
                helps!), then grab your demo login.
              </p>
              <Button
                type="button"
                size="lg"
                variant={starred ? "outline" : "primary"}
                className={cn(
                  "w-full",
                  !starred &&
                    "ring-2 ring-[var(--primary)]/40 ring-offset-2 ring-offset-[var(--background)]",
                )}
                onClick={openStarPage}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    starred && "fill-[var(--warning)] text-[var(--warning)]",
                  )}
                />
                {starred
                  ? "Opened GitHub — thanks! ⭐"
                  : "Star Intervium on GitHub to continue"}
              </Button>
            </div>

            {/* Step 2 — email (unlocks after step 1) */}
            <form
              onSubmit={submit}
              className={cn(
                "space-y-2 transition-opacity",
                !starred && "pointer-events-none opacity-50",
              )}
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input
                  type="email"
                  required
                  value={email}
                  disabled={!starred}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Your email"
                  className="h-11 pl-9"
                />
              </div>
              <LoadingButton
                type="submit"
                className="w-full"
                loading={pending}
                loadingText="Sending…"
                disabled={!starred || !email.trim()}
              >
                Email me my login <ArrowRight className="h-4 w-4" />
              </LoadingButton>
              {!starred && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Tap “Star Intervium on GitHub” above to continue.
                </p>
              )}
              <FormError message={error} />
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
