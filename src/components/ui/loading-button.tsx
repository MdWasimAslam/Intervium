import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface LoadingButtonProps extends ButtonProps {
  /** Show a spinner, disable the button, and (optionally) swap the label. */
  loading?: boolean;
  /** Replaces the children while loading, e.g. "Saving…". */
  loadingText?: React.ReactNode;
}

/**
 * Button with a built-in pending state. Wraps the design-system {@link Button}
 * so it follows the same variants/sizes and theme tokens, and standardises the
 * "spinner + disabled while working" pattern that was previously hand-rolled in
 * every form (InterviewSetup, CvWorkspace, ProfileEditor, …).
 *
 * While `loading` is true the button is disabled (prevents double-submit),
 * shows an animated spinner, exposes `aria-busy` to assistive tech, and renders
 * `loadingText` when provided (otherwise it keeps the original children).
 */
const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, loadingText, disabled, children, ...props }, ref) => (
    <Button
      ref={ref}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {loading && loadingText != null ? loadingText : children}
    </Button>
  ),
);
LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
