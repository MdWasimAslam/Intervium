"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { type AvatarConfig } from "@/components/ui/avatar-options";
import { navFor } from "@/components/layout/nav-links";

/**
 * Account dropdown: an avatar trigger that opens a small menu with a link to
 * the profile editor and a sign-out action. The sign-out server action is
 * passed in from the (server) Header so this stays a thin client wrapper.
 */
export function AccountMenu({
  userId,
  email,
  avatar,
  isAdmin = false,
  signOutAction,
}: {
  /** Drives the avatar colour — kept identical to every other avatar in the app. */
  userId: string;
  email: string;
  /** The user's chosen avatar customization (background + icon). */
  avatar?: AvatarConfig;
  isAdmin?: boolean;
  signOutAction: () => Promise<void>;
}) {
  // Primary destinations, excluding "Edit profile" — that lives in the Account
  // group below alongside Sign out.
  const navLinks = navFor(isAdmin).filter((l) => l.href !== "/profile");
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** All focusable menu items, in DOM order. */
  function items(): HTMLElement[] {
    if (!menuRef.current) return [];
    return Array.from(
      menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
  }

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (open) {
      // Wait for the menu to mount/animate in before focusing.
      const id = window.requestAnimationFrame(() => items()[0]?.focus());
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  /** Arrow-key roving between menu items. */
  function onMenuKeyDown(e: React.KeyboardEvent) {
    const all = items();
    if (all.length === 0) return;
    const currentIndex = all.indexOf(
      document.activeElement as HTMLElement,
    );
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = all[(currentIndex + 1) % all.length] ?? all[0];
      next.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev =
        all[(currentIndex - 1 + all.length) % all.length] ?? all[all.length - 1];
      prev.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      all[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      all[all.length - 1].focus();
    }
  }

  function close() {
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "rounded-full outline-none transition-opacity hover:opacity-90",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        )}
      >
        <Avatar
          seed={userId}
          name={email}
          bg={avatar?.bg}
          icon={avatar?.icon}
          size={36}
          alt={`Avatar for ${email}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
            initial={reduced ? false : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={reduced ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-3)] text-[var(--popover-foreground)] elev-3"
          >
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="text-xs text-[var(--muted-foreground)]">
                Signed in as
              </p>
              <p className="truncate text-sm font-medium">{email}</p>
            </div>

            {/* Primary navigation — mirrors the desktop header nav so every
                destination stays reachable on mobile and from any page. */}
            <div className="border-b border-[var(--border)] p-1 md:hidden">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] outline-none"
                >
                  <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                  {label}
                </Link>
              ))}
            </div>

            <div className="p-1">
              <Link
                href="/profile"
                role="menuitem"
                onClick={close}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] outline-none"
              >
                <UserCog className="h-4 w-4 text-[var(--muted-foreground)]" />
                Edit profile
              </Link>

              <form action={signOutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] outline-none"
                >
                  <LogOut className="h-4 w-4 text-[var(--muted-foreground)]" />
                  Sign out
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
