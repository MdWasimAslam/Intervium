import { PublicHeader } from "@/components/layout/PublicHeader";

/**
 * Layout for public, unauthenticated routes (landing, login, register).
 *
 * Uses a static header that reads no session, so these pages stay statically
 * prerenderable and are served from the CDN edge — fast everywhere, no cold
 * start. The auth-aware shell lives in the (app) group instead.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
    </>
  );
}
