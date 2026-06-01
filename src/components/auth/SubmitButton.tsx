"use client";

import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/loading-button";

/**
 * Submit button that shows a spinner while the form action is pending.
 * Reads pending state from the enclosing <form> via useFormStatus and
 * delegates the spinner/disabled handling to the shared LoadingButton.
 */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <LoadingButton type="submit" size="lg" className="w-full" loading={pending}>
      {children}
    </LoadingButton>
  );
}
