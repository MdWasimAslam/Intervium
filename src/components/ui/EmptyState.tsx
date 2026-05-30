import type { ReactNode } from "react";

/** Friendly placeholder shown when a collection is empty. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] py-14 text-center">
      {icon && <div className="text-[var(--muted-foreground)]">{icon}</div>}
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
