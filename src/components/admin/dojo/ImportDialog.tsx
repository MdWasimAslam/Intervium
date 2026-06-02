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
import { importDojoQuestionsFromJson } from "@/lib/actions/admin/dojo";
import type { DojoImportReport } from "@/lib/dojo/import";

const IMPORT_SAMPLE = `[
  {
    "slug": "two-sum",
    "title": "Two Sum",
    "difficulty": "easy",
    "fnName": "twoSum",
    "topics": ["Arrays", "Hash Map"],
    "prompt": "Return the indices of the two numbers that add up to target.",
    "starterCode": "function twoSum(nums, target) {\\n  // your solution\\n}\\n",
    "testCases": [
      { "input": [[2, 7, 11, 15], 9], "expected": [0, 1] }
    ]
  }
]`;

function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [report, setReport] = useState<DojoImportReport>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(dryRun: boolean) {
    setError(undefined);
    start(async () => {
      const res = await importDojoQuestionsFromJson({ json, dryRun });
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
          <DialogTitle>Import problems from JSON</DialogTitle>
          <DialogDescription>
            Paste a single problem object or an array of them. Problems are
            matched <strong>by slug</strong>; re-importing the same file inserts
            nothing new. Topics are created automatically. Validate first to
            preview.
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
              <code>difficulty</code>: easy · medium · hard.{" "}
              <code>testCases</code>: array of{" "}
              <code>{`{ "input": [args…], "expected": value, "hidden"?: bool }`}</code>
              .
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

function ImportReportView({ report }: { report: DojoImportReport }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
      <p className="font-medium">
        {report.dryRun ? "Dry run — nothing written." : "Imported."}{" "}
        <span className="text-[var(--primary)]">
          {report.dryRun ? "Would insert" : "Inserted"} {report.inserted}
        </span>
        , {report.duplicates} duplicate(s) skipped
        {report.failed > 0 && (
          <span className="text-[var(--destructive)]">
            , {report.failed} failed
          </span>
        )}
        .
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
        {report.items.map((item) => (
          <li
            key={item.index}
            className={
              item.status === "error" ? "text-[var(--destructive)]" : undefined
            }
          >
            {item.status === "ok" &&
              `✓ ${item.label}${report.dryRun ? " — would insert" : ""}`}
            {item.status === "duplicate" && `• ${item.label}: already exists`}
            {item.status === "error" && `✗ ${item.label}: ${item.error}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { ImportDialog, ImportReportView };
