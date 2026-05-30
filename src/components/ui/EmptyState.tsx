import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  /** Optional call-to-action rendered below the text (e.g. a Button). */
  action?: ReactNode;
}

/**
 * Placeholder shown when a list or collection has no items.
 */
export function EmptyState({
  title = "Nothing here yet",
  description = "There is no data to display.",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl dark:bg-gray-800">
        📭
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
