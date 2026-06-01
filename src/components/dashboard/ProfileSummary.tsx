import Link from "next/link";
import { ArrowUpRight, Clock, FileCheck2, FileX2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import { DownloadCvButton } from "@/components/cv/DownloadCvButton";
import { cn } from "@/lib/utils";
import type { DashboardProfile } from "@/lib/dashboard";

const MAX_SKILLS = 8;

/**
 * ATS-score band, mirroring the AI review's thresholds (strong 80+, good 55–79,
 * needs-work below). Used for the colored badge on the dashboard.
 */
function atsBand(score: number): { label: string; cls: string } {
  if (score >= 80) {
    return {
      label: "Strong",
      cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (score >= 55) {
    return {
      label: "Good",
      cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "Needs work",
    cls: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
  };
}

/** "3 days ago" / "yesterday" / "today", falling back to a short date. */
function relativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Scannable summary of the user's profile, with an edit shortcut. */
export function ProfileSummary({ profile }: { profile: DashboardProfile }) {
  const {
    userId,
    displayName,
    roleName,
    yearsExperience,
    skills,
    hasCv,
    atsScore,
    avatar,
    updatedAt,
  } = profile;

  const shownSkills = skills.slice(0, MAX_SKILLS);
  const extraSkills = skills.length - shownSkills.length;

  const subline = [
    roleName,
    `${yearsExperience} yr${yearsExperience === 1 ? "" : "s"} experience`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Profile</CardTitle>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--muted)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit profile
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar
            seed={userId}
            name={displayName}
            bg={avatar.bg}
            icon={avatar.icon}
            size={44}
            alt={`Avatar for ${displayName}`}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{displayName}</p>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {subline}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            Skills{skills.length > 0 ? ` · ${skills.length}` : ""}
          </p>
          {shownSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {shownSkills.map((skill) => (
                <Chip key={skill}>{skill}</Chip>
              ))}
              {extraSkills > 0 && (
                <Chip className="bg-[var(--muted)] text-[var(--muted-foreground)]">
                  +{extraSkills} more
                </Chip>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No skills added yet.
            </p>
          )}
        </div>

        {/* CV / documents */}
        <div className="space-y-2 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {hasCv ? (
                <>
                  <FileCheck2 className="h-4 w-4 text-[var(--primary)]" />
                  CV on file
                </>
              ) : (
                <>
                  <FileX2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-[var(--muted-foreground)]">
                    No CV uploaded
                  </span>
                </>
              )}
            </span>
            <Link
              href="/cv"
              className="inline-flex items-center gap-0.5 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              {hasCv ? "Open" : "Add CV"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {hasCv && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[var(--muted-foreground)]">ATS score</span>
              {atsScore != null ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    atsBand(atsScore).cls,
                  )}
                >
                  {atsScore}/100 · {atsBand(atsScore).label}
                </span>
              ) : (
                <Link
                  href="/cv"
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--primary)] hover:underline"
                >
                  Check now
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
          {hasCv && (
            <DownloadCvButton className="w-full" label="Download CV (PDF)" />
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Clock className="h-3.5 w-3.5" />
          Updated {relativeDate(updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}
