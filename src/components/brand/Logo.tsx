import { cn } from "@/lib/utils";

/**
 * The Intervium mark: a rounded brand-green badge carrying two conversational
 * turns — a prompt from one side, a reply from the other — i.e. the interview
 * as a two-way exchange. The fixed #00B775 badge reads well on both light and
 * dark backgrounds and matches the favicon and social image exactly.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Intervium logo mark"
      className={cn("h-9 w-9", className)}
    >
      <rect width="40" height="40" rx="11" fill="#00B775" />
      {/* turn one — prompt (leads from the left) */}
      <circle cx="12.5" cy="15.5" r="2.6" fill="#ffffff" />
      <rect x="17" y="13" width="13" height="5" rx="2.5" fill="#ffffff" />
      {/* turn two — reply (answers from the right) */}
      <rect x="10" y="22" width="13" height="5" rx="2.5" fill="#ffffff" />
      <circle cx="27.5" cy="24.5" r="2.6" fill="#ffffff" />
    </svg>
  );
}

/**
 * Full logo: mark + "Intervium" wordmark.
 * The wordmark uses the foreground token so it flips with the theme.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Intervium
        </span>
      )}
    </span>
  );
}
