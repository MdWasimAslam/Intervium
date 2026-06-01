import { requireAdmin } from "@/lib/session";
import { getAiUsageStats } from "@/lib/actions/admin/ai-usage";
import { AiUsageAdmin } from "@/components/admin/AiUsageAdmin";

export default async function AdminAiUsagePage() {
  await requireAdmin();
  const stats = await getAiUsageStats();
  return <AiUsageAdmin stats={stats} />;
}
