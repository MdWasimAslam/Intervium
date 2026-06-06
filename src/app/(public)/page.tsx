import { Landing } from "@/components/marketing/Landing";
import { isDemoAccessEnabled } from "@/lib/demo";

// Rendered per request so the admin "demo access" toggle takes effect live (and
// so the build never prerenders against the DB).
export const dynamic = "force-dynamic";

/**
 * Root route — the marketing landing page.
 *
 * Reads the admin "demo access" toggle to decide whether to show the public
 * "request demo access" form, so this render is dynamic. Authenticated visitors
 * never reach it: middleware redirects logged-in users on "/" to /dashboard
 * (which funnels onboarding-incomplete users to /onboarding).
 */
export default async function HomePage() {
  return <Landing demoAccessEnabled={await isDemoAccessEnabled()} />;
}
