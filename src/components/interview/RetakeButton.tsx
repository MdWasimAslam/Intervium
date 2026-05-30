"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retakeSession } from "@/lib/actions/interview";

/** Starts a new session with the same config as this one. */
export function RetakeButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await retakeSession({ sessionId });
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        Retake
      </Button>
      {error && (
        <span className="text-xs text-[var(--destructive)]">{error}</span>
      )}
    </div>
  );
}
