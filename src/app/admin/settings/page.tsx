import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { SettingsAdmin } from "@/components/admin/SettingsAdmin";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <SettingsAdmin
      defaultTimerSeconds={settings.defaultTimerSeconds}
      questionCounts={settings.questionCounts}
      transcriptionProvider={settings.transcriptionProvider}
    />
  );
}
