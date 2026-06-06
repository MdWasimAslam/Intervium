"use client";

import { useState, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SEEN_KEY = "intervium:demo-welcome:v1";
/** No-op store subscription — we only read localStorage once on mount. */
const subscribe = () => () => {};

/**
 * A one-time welcome for the shared demo account, shown once per browser. It
 * explains what the demo is (and why AI is off) so strangers aren't confused.
 * Only mounted for the demo account (gated in the app layout).
 */
export function DemoWelcomeDialog() {
  // SSR-safe: server treats it as already-seen (renders nothing); the client
  // reads localStorage. useSyncExternalStore avoids a hydration mismatch.
  const seen = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(SEEN_KEY) === "1",
    () => true,
  );
  const [closed, setClosed] = useState(false);

  if (seen || closed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode — fine, it'll just show again next time */
    }
    setClosed(true);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--primary)]" />
            Welcome to the Intervium demo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
          <p>
            You&apos;re signed in to a{" "}
            <strong className="text-[var(--foreground)]">
              shared demo account
            </strong>{" "}
            pre-loaded with sample interviews, study notes, and practice data —
            explore every feature freely.
          </p>
          <ul className="space-y-1.5">
            <li>
              •{" "}
              <strong className="text-[var(--foreground)]">
                AI features are turned off
              </strong>{" "}
              here, so it stays fast and free for everyone.
            </li>
            <li>
              • It&apos;s shared, so{" "}
              <strong className="text-[var(--foreground)]">
                your edits may be reset
              </strong>
              .
            </li>
            <li>
              • Browse the dashboard, interviews, CV tools, Code Dojo, and study
              notes.
            </li>
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={dismiss}>Got it — explore</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
