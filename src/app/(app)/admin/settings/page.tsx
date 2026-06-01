import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { SettingsAdmin } from "@/components/admin/SettingsAdmin";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <SettingsAdmin
      timerPresets={settings.timerPresets}
      defaultTimerPresetId={settings.defaultTimerPresetId}
      lengthPresets={settings.lengthPresets}
      defaultLengthPresetId={settings.defaultLengthPresetId}
      scoringProvider={settings.scoringProvider}
    />
  );
}
