"use client";

import { useState, useTransition } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  practiceWeakArea,
  type PracticeAreaInput,
} from "@/lib/actions/practice";

/** One-click start of an interview pre-configured to a weak area. */
export function PracticeAreaButton({ config }: { config: PracticeAreaInput }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col gap-1">
      <Button
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await practiceWeakArea(config);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Target />}
        Practice this area
      </Button>
      {error && (
        <span className="text-xs text-[var(--destructive)]">{error}</span>
      )}
    </div>
  );
}
