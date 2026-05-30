"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryWeakAnswers } from "@/lib/actions/practice";

/** Starts a fresh session built from the user's lowest-scored questions. */
export function RetryWeakButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col gap-1">
      <Button
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await retryWeakAnswers();
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        Retry {count} answer{count === 1 ? "" : "s"}
      </Button>
      {error && (
        <span className="text-xs text-[var(--destructive)]">{error}</span>
      )}
    </div>
  );
}
