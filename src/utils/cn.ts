/**
 * Tiny utility to conditionally join class names.
 * Filters out falsy values so you can write:
 *   cn("base", isActive && "active", error ? "text-red-500" : undefined)
 *
 * Kept dependency-free on purpose to stay beginner-friendly.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
