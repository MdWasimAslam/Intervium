import Link from "next/link";
import { FileCheck2, FileX2, Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import type { DashboardProfile } from "@/lib/dashboard";

const MAX_SKILLS = 8;

/** Scannable summary of the user's profile, with an edit shortcut. */
export function ProfileSummary({ profile }: { profile: DashboardProfile }) {
  const { userId, displayName, roleName, yearsExperience, band, skills, hasCv } =
    profile;

  const shownSkills = skills.slice(0, MAX_SKILLS);
  const extraSkills = skills.length - shownSkills.length;

  const subline = [
    roleName,
    band,
    `${yearsExperience} yr${yearsExperience === 1 ? "" : "s"} experience`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
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
            size={44}
            alt={`Avatar for ${displayName}`}
            className="shrink-0"
          />
          <div>
            <p className="text-lg font-semibold">{displayName}</p>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {subline}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
            Skills
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

        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4 text-sm">
          {hasCv ? (
            <>
              <FileCheck2 className="h-4 w-4 text-[var(--primary)]" />
              <span>CV on file</span>
            </>
          ) : (
            <>
              <FileX2 className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-[var(--muted-foreground)]">
                No CV uploaded
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
