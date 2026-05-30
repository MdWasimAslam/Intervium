import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** A single derived-metric tile for the dashboard stats row. */
export function StatTile({
  icon,
  label,
  value,
  suffix,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
        <span className="text-[var(--primary)] [&_svg]:size-4">{icon}</span>
        <span className="text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
        {value}
        {suffix && (
          <span className="text-lg font-semibold text-[var(--muted-foreground)]">
            {suffix}
          </span>
        )}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p>
      )}
    </Card>
  );
}
