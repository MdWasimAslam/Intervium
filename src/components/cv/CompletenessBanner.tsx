"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { assessCv, type CvIssue } from "@/lib/cv/completeness";
import { type CvData } from "@/lib/cv/types";

/**
 * Nudges the user to complete the universally-expected CV fields. Required
 * gaps (missing email, no experience, …) are highlighted; recommended ones
 * (location, summary, links) are listed as softer suggestions.
 */
export function CompletenessBanner({ cv }: { cv: CvData }) {
  const { issues, score, isComplete } = assessCv(cv);

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <p className="text-sm">
            Your CV covers everything recruiters and ATS systems look for. Nicely done!
          </p>
        </CardContent>
      </Card>
    );
  }

  const required = issues.filter((i) => i.severity === "required");
  const recommended = issues.filter((i) => i.severity === "recommended");

  return (
    <Card className={required.length ? "border-[var(--destructive)]/40" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {required.length ? (
              <AlertCircle className="h-5 w-5 text-[var(--destructive)]" />
            ) : (
              <Info className="h-5 w-5 text-[var(--primary)]" />
            )}
            <span className="text-sm font-semibold">
              {required.length
                ? "Add a few essentials to finish your CV"
                : "Your CV is solid — a couple of optional touches"}
            </span>
          </div>
          <span className="text-sm font-medium text-[var(--muted-foreground)]">
            {score}% complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all"
            style={{ width: `${score}%` }}
          />
        </div>

        {required.length > 0 && <IssueList title="Required" items={required} required />}
        {recommended.length > 0 && (
          <IssueList title="Recommended" items={recommended} required={false} />
        )}

        {!isComplete && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Fill these in the sections below, then press “Save changes”.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IssueList({
  title,
  items,
  required,
}: {
  title: string;
  items: CvIssue[];
  required: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((issue) => (
          <li key={issue.field} className="flex items-start gap-2 text-sm">
            <span
              className={
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " +
                (required ? "bg-[var(--destructive)]" : "bg-[var(--muted-foreground)]")
              }
            />
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
