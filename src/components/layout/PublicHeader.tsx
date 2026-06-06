import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Static app-shell header for public pages (landing, login, register).
 *
 * Unlike {@link Header}, this reads no session — so the routes that use it can
 * be statically prerendered and served straight from the CDN edge, with no
 * serverless function invocation and no cold start.
 */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-6">
        <Link href="/" aria-label="Intervium home">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button size="sm">Log in</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
