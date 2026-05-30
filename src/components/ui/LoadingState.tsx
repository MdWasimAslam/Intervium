import { Spinner } from "./Spinner";

interface LoadingStateProps {
  /** Message shown beneath the spinner. */
  message?: string;
}

/**
 * Centered loading indicator for sections that are fetching data.
 */
export function LoadingState({ message = "Loading…" }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner size={32} />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
