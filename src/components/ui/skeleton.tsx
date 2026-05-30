import { cn } from "@/lib/utils";

/** Shimmer placeholder for loading states. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--secondary)]",
        className,
      )}
      {...props}
    />
  );
}
