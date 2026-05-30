import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Centered, max-width page container with consistent horizontal padding.
 */
export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-12", className)}>
      {children}
    </div>
  );
}
