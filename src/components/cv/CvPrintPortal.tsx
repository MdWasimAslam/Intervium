"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { type CvData } from "@/lib/cv/types";
import { type CvDesign } from "./designs";
import { CvDocument } from "./CvDocument";

// Mount the portal only on the client (false during SSR) without an effect —
// avoids both hydration mismatch and cascading-render lint warnings.
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * The print-only, <body>-portaled copy of a CV, shared by the /cv preview and
 * every "Download PDF" button. Hidden on screen; the global `@media print` rules
 * show only `.cv-print-root` and recreate per-page top/bottom margins via the
 * repeating <thead>/<tfoot> spacer rows. Rendering it is what makes
 * `window.print()` produce the CV instead of the surrounding app chrome.
 */
export function CvPrintPortal({
  cv,
  design,
}: {
  cv: CvData;
  design?: CvDesign;
}) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <div className="cv-print-root">
      <table className="cv-print-table">
        <thead>
          <tr>
            <td>
              <div className="cv-print-pad" />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="cv-print-cell">
              <CvDocument cv={cv} design={design} />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div className="cv-print-pad-bottom" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>,
    document.body,
  );
}
