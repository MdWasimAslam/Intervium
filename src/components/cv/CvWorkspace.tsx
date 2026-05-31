"use client";

import { useCallback, useState } from "react";
import { Check, FileText, Loader2, Target, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type CvData } from "@/lib/cv/types";
import { saveCv } from "@/lib/actions/cv";
import { CvEditor } from "./CvEditor";
import { CvPreview } from "./CvPreview";
import { AtsPanel } from "./AtsPanel";
import { CompletenessBanner } from "./CompletenessBanner";

type Tab = "edit" | "ats";

/**
 * Top-level /cv client surface. Owns the working `CvData` and persistence;
 * delegates editing, preview, and ATS matching to child panels.
 */
export function CvWorkspace({ initial }: { initial: CvData }) {
  const [cv, setCv] = useState<CvData>(initial);
  const [tab, setTab] = useState<Tab>("edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  // Pre-optimization CV, stashed so an applied optimization can be undone.
  const [previousCv, setPreviousCv] = useState<CvData | null>(null);

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

  /**
   * Replace the CV (e.g. accepting an optimized version) and persist it.
   * The pre-optimization CV is stashed so it can be restored via Undo.
   */
  const applyAndSave = useCallback(
    (next: CvData) => {
      setCv((prev) => {
        setPreviousCv(prev);
        return next;
      });
      void persist(next);
    },
    [persist],
  );

  /** Restore the CV that was live before the last optimization was applied. */
  const undoApply = useCallback(() => {
    if (!previousCv) return;
    setCv(previousCv);
    void persist(previousCv);
    setPreviousCv(null);
  }, [previousCv, persist]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My CV</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Edit, download, and tailor your CV to any job — keyword scoring is
            instant and free; AI is used only to polish.
          </p>
        </div>
        <nav className="inline-flex shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
          <TabButton active={tab === "edit"} onClick={() => setTab("edit")} icon={<FileText className="h-4 w-4" />}>
            Edit & Preview
          </TabButton>
          <TabButton active={tab === "ats"} onClick={() => setTab("ats")} icon={<Target className="h-4 w-4" />}>
            ATS Match
          </TabButton>
        </nav>
      </header>

      {tab === "edit" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-3">
            {error && <span className="text-sm text-[var(--destructive)]">{error}</span>}
            {previousCv && (
              <Button variant="outline" onClick={undoApply} disabled={saving}>
                <Undo2 className="h-4 w-4" />
                Undo optimization
              </Button>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-sm text-[var(--primary)]">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
            <Button onClick={() => void persist(cv)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
          <CompletenessBanner cv={cv} />
          <div className="grid gap-6 lg:grid-cols-2">
            <CvEditor cv={cv} onChange={setCv} />
            <div className="lg:sticky lg:top-20 lg:self-start">
              <CvPreview cv={cv} />
            </div>
          </div>
        </div>
      ) : (
        <AtsPanel cv={cv} onApplyOptimized={applyAndSave} />
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
