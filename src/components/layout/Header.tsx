import Link from "next/link";
import { Zap } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, profiles } from "@db";
import { signOut } from "@/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { toAvatarConfig } from "@/components/ui/avatar-options";
import { getCurrentUser } from "@/lib/session";

/**
 * App shell header: logo + primary nav on the left; theme toggle + account
 * menu on the right. Renders the account menu when authenticated, otherwise a
 * link to log in. The inline nav is desktop-only — on mobile the same links
 * live inside the account dropdown.
 */
export async function Header() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  // The user's chosen avatar (one small PK lookup) so the header matches the
  // rest of the app. Falls back to the generated avatar when nothing is set.
  let avatar = undefined;
  if (user) {
    const [row] = await db
      .select({ avatar: profiles.avatar })
      .from(profiles)
      .where(eq(profiles.userId, user.id));
    avatar = toAvatarConfig(row?.avatar);
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} aria-label="Intervium home">
            <Logo />
          </Link>
          {user && <HeaderNav isAdmin={isAdmin} />}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Link href="/interview/new">
              <Button size="sm">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Start interview</span>
              </Button>
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <AccountMenu
              userId={user.id}
              email={user.email ?? "Account"}
              avatar={avatar}
              isAdmin={isAdmin}
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
