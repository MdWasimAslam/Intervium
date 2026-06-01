"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navFor } from "@/components/layout/nav-links";

/**
 * Inline primary navigation for the desktop header. Hidden on small screens,
 * where the same destinations live in the account-menu dropdown instead.
 * Highlights the section matching the current route.
 */
export function HeaderNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = navFor(isAdmin).filter((l) => l.inHeader);

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map(({ href, label }) => {
        const active =
          href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
