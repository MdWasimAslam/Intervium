import Link from "next/link";
import { navFor } from "@/components/layout/nav-links";

/**
 * Tidy shortcut row to existing pages only, derived from the shared nav list.
 * Admin appears solely for admins (the same role check the rest of the app uses).
 */
export function QuickLinks({ isAdmin }: { isAdmin: boolean }) {
  const links = navFor(isAdmin).filter((l) => l.inShortcuts);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Shortcuts</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)]">
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
