"use client";

import { useCallback, useState } from "react";
import { Check, FileText, Mail, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingButton } from "@/components/ui/loading-button";
import { type AtsReviewSnapshot, type CvData } from "@/lib/cv/types";
import { saveCv } from "@/lib/actions/cv";
import { CvEditor } from "./CvEditor";
import { CvPreview } from "./CvPreview";
import { AtsPanel } from "./AtsPanel";
import { CvAiReview } from "./CvAiReview";
import { CoverLetterPanel } from "./CoverLetterPanel";

type Tab = "edit" | "ats" | "cover";

/**
 * Top-level /cv client surface. Owns the working `CvData` and persistence;
 * delegates editing, preview, ATS matching, and cover letters to child panels.
 *
 * Optimizing a CV for a job is download-only and never touches the stored CV —
 * only the explicit "Save changes" button below persists. The pasted job
 * description is owned here so the Cover Letter tab can reuse it.
 */
export function CvWorkspace({
  initial,
  initialAts,
}: {
  initial: CvData;
  initialAts: AtsReviewSnapshot | null;
}) {
  const [cv, setCv] = useState<CvData>(initial);
  const [tab, setTab] = useState<Tab>("edit");
  const [jd, setJd] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  const persist = useCallback(async (next: CvData) => {
    setSaving(true);
    setSaved(false);
    setError(undefined);
    const res = await saveCv(next);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.error);
    }
    return res.ok;
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex">
        <nav className="inline-flex shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
          <TabButton
            active={tab === "edit"}
            onClick={() => setTab("edit")}
            icon={<FileText className="h-4 w-4" />}
          >
            Edit & Preview
          </TabButton>
          <TabButton
            active={tab === "ats"}
            onClick={() => setTab("ats")}
            icon={<Target className="h-4 w-4" />}
          >
            ATS Match
          </TabButton>
          <TabButton
            active={tab === "cover"}
            onClick={() => setTab("cover")}
            icon={<Mail className="h-4 w-4" />}
          >
            Cover Letter
          </TabButton>
        </nav>
      </header>

      {tab === "edit" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-3">
            {error && (
              <span className="text-sm text-[var(--destructive)]">{error}</span>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-sm text-[var(--primary)]">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
            <LoadingButton
              onClick={() => void persist(cv)}
              loading={saving}
              loadingText="Saving…"
            >
              <Check className="h-4 w-4" />
              Save changes
            </LoadingButton>
          </div>
          <CvAiReview cv={cv} initial={initialAts} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <CvEditor cv={cv} onChange={setCv} />
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
              <CvPreview cv={cv} />
            </div>
          </div>
        </div>
      ) : tab === "ats" ? (
        <AtsPanel cv={cv} jd={jd} onJdChange={setJd} />
      ) : (
        <CoverLetterPanel initialJobDescription={jd} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
