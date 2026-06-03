import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { AiModelsAdmin } from "@/components/admin/AiModelsAdmin";

export const metadata: Metadata = { title: "AI Models" };

export default async function AdminAiModelsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <AiModelsAdmin
      featureModels={settings.featureModels}
      scoringProvider={settings.scoringProvider}
    />
  );
}
