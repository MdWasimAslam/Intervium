import Link from "next/link";
import { signOut } from "@/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { getCurrentUser } from "@/lib/session";

/**
 * App shell header: logo on the left; theme toggle + auth actions on the right.
 * Renders the account menu when authenticated, otherwise a link to log in.
 */
export async function Header() {
  const user = await getCurrentUser();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          aria-label="Intervium home"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <AccountMenu
              email={user.email ?? "Account"}
              signOutAction={handleSignOut}
            />
          ) : (
            <Link href="/login">
              <Button size="sm">Log in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
