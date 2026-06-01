import { CalendarClock, CheckCircle2, Flame } from "lucide-react";
import { StatTile } from "@/components/dashboard/StatTile";
import type { DojoStats } from "@/lib/dojo/types";
import type { StreakInfo } from "@/lib/streaks";

/** Practice cadence + solved totals for the Dojo screen. */
export function DojoStatsStrip({
  streak,
  stats,
}: {
  streak: StreakInfo;
  stats: DojoStats;
}) {
  const { easy, medium, hard } = stats.byDifficulty;
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatTile
        icon={<Flame />}
        label="Streak"
        value={String(streak.current)}
        suffix={streak.current === 1 ? " day" : " days"}
        hint={`longest ${streak.longest}`}
      />
      <StatTile
        icon={<CheckCircle2 />}
        label="Solved"
        value={String(stats.solvedTotal)}
        hint={`${easy} easy · ${medium} med · ${hard} hard`}
      />
      <StatTile
        icon={<CalendarClock />}
        label="This week"
        value={String(stats.solvedThisWeek)}
        hint="solved"
      />
    </div>
  );
}
