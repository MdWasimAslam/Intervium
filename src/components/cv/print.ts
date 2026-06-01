/**
 * Open the browser print dialog AFTER the embedded CV webfonts are ready.
 *
 * The CV uses self-hosted next/font webfonts (so preview and PDF share identical
 * metrics). If `window.print()` fires before those fonts have loaded/laid out,
 * the first print can fall back to system metrics and the PDF won't match the
 * preview. Awaiting `document.fonts.ready` closes that race. Best-effort — if
 * the Font Loading API is unavailable we still print.
 */
export async function printCv(): Promise<void> {
  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready;
    }
  } catch {
    // Ignore — print regardless of whether the API resolved.
  }
  window.print();
}
