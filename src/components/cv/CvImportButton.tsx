"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importCvFromTextAction } from "@/lib/actions/cv";

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * "Upload PDF" control for the CV JSON fields. The PDF is read and its text is
 * extracted entirely in the browser (unpdf, lazy-loaded on click), so the file
 * itself never leaves the device — only the extracted text is sent to the Groq
 * action, which returns structured CvData. The parent receives that CV as a
 * pretty-printed JSON string, ready to drop into the textarea.
 */
export function CvImportButton({
  onImported,
  disabled,
  className,
}: {
  /** Called with the imported CV as a pretty-printed JSON string. */
  onImported: (json: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function handleFile(file: File) {
    setError(undefined);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("That PDF is too large (max 8 MB).");
      return;
    }

    setBusy(true);
    try {
      // Extract text in the browser — the PDF never leaves the device.
      const { extractText, getDocumentProxy } = await import("unpdf");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join("\n") : text).trim();

      if (clean.length < 30) {
        setError(
          "Couldn't read text from this PDF — it may be scanned. Paste your CV as JSON instead.",
        );
        return;
      }

      const res = await importCvFromTextAction(clean);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onImported(JSON.stringify(res.data, null, 2));
    } catch {
      setError("Couldn't process that PDF. Paste your CV as JSON instead.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {busy ? "Reading PDF…" : "Upload PDF"}
      </Button>
      {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
