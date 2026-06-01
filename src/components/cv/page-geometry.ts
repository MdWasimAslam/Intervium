/**
 * Canonical print-page geometry for the CV.
 *
 * The on-screen preview and the printed PDF render the SAME `CvDocument` at the
 * SAME fixed width — historically the single biggest reason a downloaded CV
 * didn't match its preview was that the two rendered at different widths, so
 * line-wrapping, vertical flow, and pagination diverged. Pinning one width
 * (A4 content area at 96dpi, where 1mm = 96/25.4 px) removes that whole class
 * of bug.
 *
 * The page MARGINS themselves live in CSS (`@media print` in globals.css)
 * because CSS can't import TS; the millimetre values below MIRROR those rules,
 * and a unit test asserts the derived px values stay in sync.
 */
const PX_PER_MM = 96 / 25.4;

/** A4 portrait, with the margins recreated by the print table's spacer rows. */
export const CV_PAGE = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  /** `.cv-print-cell` left/right padding. */
  marginXmm: 14,
  /** `.cv-print-pad` (thead) — top margin, repeats at the top of every page. */
  padTopMm: 18,
  /** `.cv-print-pad-bottom` (tfoot) — bottom margin, repeats per page. */
  padBottomMm: 14,
} as const;

/** Printable content WIDTH in px — the fixed width `CvDocument` renders at. */
export const CV_CONTENT_WIDTH_PX = Math.round(
  (CV_PAGE.pageWidthMm - 2 * CV_PAGE.marginXmm) * PX_PER_MM,
); // (210 − 28)mm → 688px

/** Usable content HEIGHT per page in px — drives the on-screen page guides. */
export const CV_PAGE_CONTENT_HEIGHT_PX = Math.round(
  (CV_PAGE.pageHeightMm - CV_PAGE.padTopMm - CV_PAGE.padBottomMm) * PX_PER_MM,
); // (297 − 32)mm → 1002px
