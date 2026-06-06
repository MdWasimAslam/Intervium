import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getDemoRequestStats } from "@/lib/demo-analytics";
import { SettingsAdmin } from "@/components/admin/SettingsAdmin";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, demoStats] = await Promise.all([
    getSettings(),
    getDemoRequestStats(),
  ]);
  return (
    <SettingsAdmin
      timerPresets={settings.timerPresets}
      defaultTimerPresetId={settings.defaultTimerPresetId}
      lengthPresets={settings.lengthPresets}
      defaultLengthPresetId={settings.defaultLengthPresetId}
      scoringProvider={settings.scoringProvider}
      demoMode={settings.demoMode}
      demoStats={demoStats}
    />
  );
}
