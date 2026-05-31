import { Header } from "@/components/layout/Header";

/**
 * Layout for authenticated app routes (dashboard, profile, interview, admin, …).
 *
 * Renders the session-aware {@link Header}. Reading the session here makes these
 * routes dynamic — which is correct, since every one of them requires auth and
 * renders per-user data anyway. Public routes live in the (public) group so they
 * are not dragged into dynamic rendering by this header.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
    </>
  );
}
