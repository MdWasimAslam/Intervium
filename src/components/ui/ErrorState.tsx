import { Button } from "./Button";

interface ErrorStateProps {
  /** Human-readable error message. */
  message?: string;
  /** Optional retry handler; renders a "Try again" button when provided. */
  onRetry?: () => void;
}

/**
 * Friendly error placeholder for failed data fetches.
 */
export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
        ⚠️
      </div>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
