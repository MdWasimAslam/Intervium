import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Field-level error; when set, the input is flagged invalid and described by it. */
  error?: string;
}

/** Labelled input styled with the shared design tokens. */
export function AuthField({
  label,
  id,
  className,
  error,
  "aria-describedby": describedBy,
  ...props
}: AuthFieldProps) {
  const errorId = error && id ? `${id}-error` : undefined;
  const describedByValue =
    [describedBy, errorId].filter(Boolean).join(" ") || undefined;

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
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedByValue}
        className={cn(
          "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors",
          "placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/30",
          error && "border-[var(--destructive)]",
          className,
        )}
        {...props}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
