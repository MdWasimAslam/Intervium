import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names intelligently.
 * `clsx` handles conditional classes; `tailwind-merge` de-duplicates
 * conflicting Tailwind utilities (e.g. `px-2 px-4` → `px-4`).
 *
 * This is the standard shadcn/ui `cn` helper.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
