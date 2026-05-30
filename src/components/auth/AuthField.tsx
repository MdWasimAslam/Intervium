import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Labelled input styled with the shared design tokens. */
export function AuthField({ label, id, className, ...props }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--foreground)]"
      >
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors",
          "placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/30",
          className,
        )}
        {...props}
      />
    </div>
  );
}
