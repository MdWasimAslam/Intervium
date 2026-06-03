import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline alert banner driven by the semantic status tokens. Replaces ad-hoc
 * coloured text so info/success/warning/error read consistently in both themes.
 */
const alertVariants = cva(
  "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-[var(--info)]/30 bg-[var(--info-subtle)] text-[var(--foreground)]",
        success:
          "border-[var(--success)]/30 bg-[var(--success-subtle)] text-[var(--foreground)]",
        warning:
          "border-[var(--warning)]/30 bg-[var(--warning-subtle)] text-[var(--foreground)]",
        error:
          "border-[var(--destructive)]/30 bg-[var(--destructive-subtle)] text-[var(--foreground)]",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const icons: Record<NonNullable<VariantProps<typeof alertVariants>["variant"]>, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const iconColor: Record<
  NonNullable<VariantProps<typeof alertVariants>["variant"]>,
  string
> = {
  info: "text-[var(--info)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  error: "text-[var(--destructive)]",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({
  variant = "info",
  title,
  className,
  children,
  ...props
}: AlertProps) {
  const resolved = variant ?? "info";
  const Icon = icons[resolved];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor[resolved])} aria-hidden />
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && (
          <div className="text-[var(--muted-foreground)]">{children}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Full-block error state (icon + message + optional retry action). The error
 * counterpart to `EmptyState`; use in error boundaries and failed loads.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--destructive)]/40 bg-[var(--destructive-subtle)] py-14 text-center">
      <XCircle className="h-8 w-8 text-[var(--destructive)]" aria-hidden />
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
