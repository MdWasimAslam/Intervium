"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPrimaryCvAction } from "@/lib/actions/cv";
import { type CvData } from "@/lib/cv/types";
import { CvPrintPortal } from "./CvPrintPortal";
import { readPreferredDesignId } from "./cv-design-store";
import { DEFAULT_DESIGN_ID, getCvDesign } from "./designs";
import { printCv } from "./print";

/**
 * One-click "Download my CV as PDF" from anywhere (e.g. the dashboard). Loads
 * the stored CV on demand, renders the same print-only portal CvPreview uses
 * (hidden on screen, isolated by the global @media print rules) in the user's
 * saved default design, then opens the browser print dialog → Save as PDF.
 */
export function DownloadCvButton({
  className,
  label = "Download PDF",
}: {
  className?: string;
  label?: string;
}) {
  const [cv, setCv] = useState<CvData | null>(null);
  const [designId, setDesignId] = useState(DEFAULT_DESIGN_ID);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const printWhenReady = useRef(false);

  // The portal must be in the DOM before we open the print dialog, so we print
  // from an effect once the freshly-loaded CV has rendered.
  useEffect(() => {
    if (cv && printWhenReady.current) {
      printWhenReady.current = false;
      void printCv();
    }
  }, [cv]);

  async function onClick() {
    setError(undefined);
    setDesignId(readPreferredDesignId());

    // Already loaded — the portal is mounted, just print again.
    if (cv) {
      void printCv();
      return;
    }

    setLoading(true);
    const res = await getPrimaryCvAction();
    setLoading(false);
    if (res.ok) {
      printWhenReady.current = true;
      setCv(res.data);
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void onClick()}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {label}
      </Button>
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}

      {cv && <CvPrintPortal cv={cv} design={getCvDesign(designId)} />}
    </>
  );
}
