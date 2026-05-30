import { cn } from "@/utils/cn";

interface SpinnerProps {
  className?: string;
  /** Diameter of the spinner in pixels. */
  size?: number;
}

/**
 * Small, accessible loading spinner used by loading states.
 */
export function Spinner({ className, size = 24 }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
        className,
      )}
    />
  );
}
