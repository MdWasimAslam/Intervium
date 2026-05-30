import Link from "next/link";
import { APP_NAME } from "@/constants";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface NavbarProps {
  /** Username of the logged-in user, or null when signed out. */
  username: string | null;
}

/**
 * Top navigation bar.
 * Shows the theme toggle plus auth-aware actions (login vs. logout).
 */
export function Navbar({ username }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold text-gray-900 dark:text-gray-50"
        >
          {APP_NAME}
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {username ? (
            <>
              <Link
                href="/dashboard"
                className="hidden rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:block dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Dashboard
              </Link>
              <span className="hidden text-sm text-gray-500 sm:inline dark:text-gray-400">
                {username}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Log in</Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
