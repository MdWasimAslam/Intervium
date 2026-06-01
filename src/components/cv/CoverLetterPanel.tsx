"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, Download, RefreshCw, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  deleteCoverLetter,
  generateCoverLetterAction,
  listCoverLetters,
  saveCoverLetter,
  type CoverLetterRecord,
} from "@/lib/actions/cv";
import type { CoverLetterType } from "@/lib/groq";

type Tab = "generate" | "saved";

const TYPES: { value: CoverLetterType; label: string }[] = [
  { value: "generic", label: "Generic" },
  { value: "job_specific", label: "Job-specific" },
  { value: "company_specific", label: "Company-specific" },
];

const TYPE_LABEL: Record<string, string> = {
  generic: "Generic",
  job_specific: "Job-specific",
  company_specific: "Company-specific",
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Feature 9 — generate, edit, save, copy and download cover letters.
 *
 * `initialJobDescription` carries over whatever was pasted on the ATS Match tab:
 * when present, the JD is pre-filled and the type defaults to "Job-specific", so
 * the user can generate a letter for that exact role in one click. (This panel
 * remounts on every tab switch, so the seed always reflects the latest JD.)
 */
export function CoverLetterPanel({
  initialJobDescription = "",
}: {
  initialJobDescription?: string;
}) {
  const seededJd = initialJobDescription.trim();
  const [tab, setTab] = useState<Tab>("generate");
  const [letterType, setLetterType] = useState<CoverLetterType>(
    seededJd ? "job_specific" : "generic",
  );
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [pending, start] = useTransition();

  const [saved, setSaved] = useState<CoverLetterRecord[] | null>(null);

  const refreshSaved = useCallback(() => {
    void listCoverLetters().then(setSaved);
  }, []);

  useEffect(() => {
    if (tab === "saved") refreshSaved();
  }, [tab, refreshSaved]);

  const loadingSaved = tab === "saved" && saved === null;

  const needsJd = letterType === "job_specific";
  const needsCompany = letterType === "company_specific";

  function generate() {
    setError(undefined);
    setSavedNote(false);
    start(async () => {
      const res = await generateCoverLetterAction({
        letterType,
        jobTitle,
        companyName,
        jobDescription,
      });
      if (res.ok) setContent(res.data.content);
      else setError(res.error);
    });
  }

  function save() {
    setError(undefined);
    start(async () => {
      const res = await saveCoverLetter({
        letterType,
        jobTitle,
        companyName,
        jobDescription,
        content,
      });
      if (res.ok) {
        setSavedNote(true);
        window.setTimeout(() => setSavedNote(false), 2500);
      } else setError(res.error);
    });
  }

  function copy() {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      <nav className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
        <TabButton active={tab === "generate"} onClick={() => setTab("generate")}>
          Generate
        </TabButton>
        <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
          Saved
        </TabButton>
      </nav>

      {tab === "generate" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cover letter generator</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Built truthfully from your saved CV — it never invents experience.
            </p>
            {seededJd && (
              <p className="text-sm text-[var(--primary)]">
                Using the job description from ATS Match — just hit Generate.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={letterType}
                  onValueChange={(v) => setLetterType(v as CoverLetterType)}
                >
                  <SelectTrigger aria-label="Cover letter type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cl-title">Target role (optional)</Label>
                <Input
                  id="cl-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>
            </div>

            {needsCompany && (
              <div className="space-y-1.5">
                <Label htmlFor="cl-company">Company</Label>
                <Input
                  id="cl-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
            )}

            {(needsJd || needsCompany) && (
              <div className="space-y-1.5">
                <Label htmlFor="cl-jd">
                  Job description {needsJd ? "" : "(optional)"}
                </Label>
                <Textarea
                  id="cl-jd"
                  rows={5}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description…"
                />
              </div>
            )}

            <LoadingButton
              onClick={generate}
              loading={pending}
              loadingText="Generating…"
            >
              {content ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {content ? "Regenerate" : "Generate cover letter"}
            </LoadingButton>

            {error && (
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            )}

            {content && (
              <div className="space-y-3">
                <Textarea
                  rows={16}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  aria-label="Cover letter content"
                  className="font-sans text-sm leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copy}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadText(
                        `cover-letter-${companyName || jobTitle || "draft"}.txt`
                          .replace(/\s+/g, "-")
                          .toLowerCase(),
                        content,
                      )
                    }
                  >
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <LoadingButton size="sm" onClick={save} loading={pending}>
                    <Save className="h-4 w-4" /> Save
                  </LoadingButton>
                  {savedNote && (
                    <span className="text-sm text-[var(--primary)]">Saved ✓</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <SavedList
          letters={saved ?? []}
          loading={loadingSaved}
          onDeleted={refreshSaved}
        />
      )}
    </div>
  );
}

function SavedList({
  letters,
  loading,
  onDeleted,
}: {
  letters: CoverLetterRecord[];
  loading: boolean;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string>();

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
    );
  }
  if (letters.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
          No saved cover letters yet. Generate one and hit Save.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {letters.map((l) => (
        <Card key={l.id}>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {l.companyName || l.jobTitle || "Cover letter"}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {TYPE_LABEL[l.letterType] ?? l.letterType} ·{" "}
                  {new Date(l.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(l.content)}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      `cover-letter-${l.companyName || l.jobTitle || "saved"}.txt`
                        .replace(/\s+/g, "-")
                        .toLowerCase(),
                      l.content,
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete cover letter"
                  className="text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                  disabled={pending && busyId === l.id}
                  onClick={() =>
                    start(async () => {
                      setBusyId(l.id);
                      const res = await deleteCoverLetter(l.id);
                      if (res.ok) onDeleted();
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">
              {l.content}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}
