"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CvData } from "@/lib/cv/types";
import { CvDocument } from "./CvDocument";

// Render the print portal only on the client (false during SSR), without an
// effect — avoids both hydration mismatch and cascading-render lint warnings.
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * On-screen CV preview plus print-to-PDF. The printable copy is rendered into
 * a portal at the end of <body> (class `cv-print-root`); the print stylesheet
 * hides every other top-level node, so the PDF contains ONLY the CV — no app
 * chrome, and no blank trailing pages from invisible-but-laid-out content.
 */
export function CvPreview({ cv }: { cv: CvData }) {
  const mounted = useMounted();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">Preview</span>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      {/* On-screen preview card */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <CvDocument cv={cv} />
      </div>

      {/* Print-only copy, portaled to <body> so it can stand alone when printing */}
      {mounted &&
        createPortal(
          <div className="cv-print-root">
            <div className="cv-print-page">
              <CvDocument cv={cv} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
