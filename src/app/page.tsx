import { redirect } from "next/navigation";
import { getCurrentUser, isOnboardingComplete } from "@/lib/session";
import { Landing } from "@/components/marketing/Landing";

/**
 * Root route.
 *
 * - Logged-in + onboarded → the dashboard.
 * - Logged-in but onboarding unfinished → the onboarding wizard (existing guard).
 * - Logged-out → the marketing landing page.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    const onboarded = await isOnboardingComplete(user.id);
    redirect(onboarded ? "/dashboard" : "/onboarding");
  }

  return <Landing />;
}
