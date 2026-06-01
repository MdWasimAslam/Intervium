"use client";

import { type InputHTMLAttributes, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
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
  disabled,
  type,
  "aria-describedby": describedBy,
  ...props
}: AuthFieldProps) {
  // Lock the field while the enclosing form action is in flight so users can't
  // edit mid-submission. Safe outside a form too (pending is then always false).
  const { pending } = useFormStatus();
  // Password fields get a show/hide toggle that swaps the input type in place.
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const effectiveType = isPassword && show ? "text" : type;
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
      <div className="relative">
        <input
          id={id}
          type={effectiveType}
          disabled={disabled || pending}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedByValue}
          className={cn(
            "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors",
            "placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
            isPassword && "pr-11",
            error && "border-[var(--destructive)]",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            disabled={disabled || pending}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-60"
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
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
