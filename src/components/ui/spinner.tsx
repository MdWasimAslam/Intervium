import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
} as const;

export interface SpinnerProps
  extends React.HTMLAttributes<SVGSVGElement> {
  size?: keyof typeof sizes;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

/**
 * Standardised loading spinner (lucide `Loader2` + `animate-spin`). Used by
 * `LoadingButton` and inline waits so spinners look identical everywhere.
 */
export function Spinner({
  size = "md",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn(
        "animate-spin text-[var(--muted-foreground)]",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
