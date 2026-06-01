import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isOnboardingComplete, requireAuth } from "@/lib/session";
import { getGapAnalysis } from "@/lib/gap-analysis";
import { Container } from "@/components/layout/Container";
import { GapAnalysisView } from "@/components/gap/GapAnalysisView";

export const metadata: Metadata = { title: "Resume vs Interview" };

// One Groq call (the gap report) runs here; give it function headroom.
export const maxDuration = 60;

export default async function GapAnalysisPage() {
  const user = await requireAuth();
  if (!(await isOnboardingComplete(user.id))) redirect("/onboarding");

  const data = await getGapAnalysis(user.id);

  return (
    <Container className="max-w-3xl py-10 sm:py-12">
      <GapAnalysisView data={data} />
    </Container>
  );
}
