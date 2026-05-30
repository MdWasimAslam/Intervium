/**
 * Formatting helpers shared across the UI.
 */

/**
 * Format an ISO date string into a human-readable date.
 * Returns the original string if it cannot be parsed.
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Capitalise the first letter of a string.
 */
export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
