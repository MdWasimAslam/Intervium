"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/auth/FormError";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importQuestionsFromJson } from "@/lib/actions/admin/questions";
import type { ImportReport } from "@/lib/questions/import";

const IMPORT_SAMPLE = `[
  {
    "role": "Software Developer",
    "techStack": "React",
    "category": "technical",
    "modality": "text",
    "questions": [
      { "questionText": "…", "idealAnswer": "…" }
    ]
  }
]`;

function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [report, setReport] = useState<ImportReport>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(dryRun: boolean) {
    setError(undefined);
    start(async () => {
      const res = await importQuestionsFromJson({ json, dryRun });
      if (!res.ok) {
        setError(res.error);
        setReport(undefined);
        return;
      }
      setReport(res.report);
      if (!dryRun) router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setReport(undefined);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Bulk JSON import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import questions from JSON</DialogTitle>
          <DialogDescription>
            Paste an array of blocks. Profession and specialization are matched{" "}
            <strong>by name</strong> (case-insensitive). Re-importing the same
            file inserts nothing new. Validate first to preview.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={10}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={IMPORT_SAMPLE}
            className="font-mono text-xs"
            aria-label="Import JSON"
          />
          <details className="text-xs text-[var(--muted-foreground)]">
            <summary className="cursor-pointer">Expected format</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--muted)] p-2">
              {IMPORT_SAMPLE}
            </pre>
            <p className="mt-1">
              <code>category</code>: technical · behavioral.{" "}
              <code>modality</code> (optional): text · coding (default text).
            </p>
          </details>
          {report && <ImportReportView report={report} />}
          {error && <FormError message={error} />}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
          <Button
            variant="outline"
            disabled={pending || !json.trim()}
            onClick={() => run(true)}
          >
            {pending ? "Working…" : "Validate (dry run)"}
          </Button>
          <Button disabled={pending || !json.trim()} onClick={() => run(false)}>
            {pending ? "Working…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportReportView({ report }: { report: ImportReport }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
      <p className="font-medium">
        {report.dryRun ? "Dry run — nothing written." : "Imported."}{" "}
        <span className="text-[var(--primary)]">
          {report.dryRun ? "Would insert" : "Inserted"} {report.inserted}
        </span>
        , {report.duplicates} duplicate(s) skipped
        {report.blocksFailed > 0 && (
          <span className="text-[var(--destructive)]">
            , {report.blocksFailed} block(s) failed
          </span>
        )}
        .
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
        {report.blocks.map((b) => (
          <li
            key={b.index}
            className={
              b.status === "error" ? "text-[var(--destructive)]" : undefined
            }
          >
            {b.status === "ok" && `✓ ${b.label}: +${b.inserted}`}
            {b.status === "empty" && `• ${b.label}: nothing new`}
            {b.status === "error" && `✗ ${b.label}: ${b.error}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ImportDialog, ImportReportView };
