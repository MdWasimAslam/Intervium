import { Landing } from "@/components/marketing/Landing";

/**
 * Root route — the marketing landing page.
 *
 * Statically prerendered and served from the CDN edge. Authenticated visitors
 * never reach this render: the middleware redirects logged-in users on "/" to
 * /dashboard (which in turn funnels onboarding-incomplete users to /onboarding).
 */
export default function HomePage() {
  return <Landing />;
}
