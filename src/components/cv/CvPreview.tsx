"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type CvData } from "@/lib/cv/types";
import { CvDocument } from "./CvDocument";
import { CvPrintPortal } from "./CvPrintPortal";
import { CV_DESIGNS, getCvDesign } from "./designs";
import { usePreferredDesignId, writePreferredDesignId } from "./cv-design-store";
import { CV_PAGE_CONTENT_HEIGHT_PX } from "./page-geometry";
import { printCv } from "./print";

/**
 * On-screen CV preview plus print-to-PDF. A design dropdown picks the visual
 * template (and can be saved as the default in localStorage); the choice
 * applies to BOTH the on-screen preview and the printed copy, so the
 * downloaded PDF matches what's shown. The same saved default is reused by the
 * dashboard download and the job-tailored optimize download.
 */
export function CvPreview({ cv }: { cv: CvData }) {
  // The saved default (from localStorage), overridden by an in-session pick.
  const preferred = usePreferredDesignId();
  const [override, setOverride] = useState<string | null>(null);
  const [savedDefault, setSavedDefault] = useState(false);
  const designId = override ?? preferred;
  const design = getCvDesign(designId);

  function onDesignChange(id: string) {
    setOverride(id);
    setSavedDefault(false);
  }

  function saveAsDefault() {
    writePreferredDesignId(designId);
    setOverride(null); // effective design now follows the saved default
    setSavedDefault(true);
    window.setTimeout(() => setSavedDefault(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mt-1 flex flex-wrap items-center justify-between gap-2 bg-[var(--background)] py-1 print:hidden">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">Preview</span>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={designId} onValueChange={onDesignChange}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="CV design">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CV_DESIGNS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={saveAsDefault}
            aria-label="Save this design as your default"
          >
            <Check className="h-4 w-4" />
            {savedDefault ? "Saved" : "Set as default"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void printCv()}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* On-screen preview card. overflow-x-auto so the fixed-width A4 document
          scrolls on a narrow pane instead of reflowing — reflowing would make
          the preview stop matching the PDF. The faint guides mark page breaks. */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <div className="relative mx-auto w-fit">
          <CvDocument cv={cv} design={design} />
          <div
            aria-hidden
            className="cv-page-guides absolute inset-0 print:hidden"
            style={
              {
                "--cv-page-h": `${CV_PAGE_CONTENT_HEIGHT_PX}px`,
              } as React.CSSProperties
            }
          />
        </div>
      </div>

      {/* Print-only copy, portaled to <body>, in the same design as the preview. */}
      <CvPrintPortal cv={cv} design={design} />
    </div>
  );
}
