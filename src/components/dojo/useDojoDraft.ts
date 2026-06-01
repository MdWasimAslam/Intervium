"use client";

import { useState } from "react";
import { generateDojoQuestionDraftAction } from "@/lib/actions/dojo";
import type { DojoQuestionDraft } from "@/lib/groq";

export interface DraftInput {
  topic?: string;
  difficulty: "easy" | "medium" | "hard";
  prompt?: string;
}

/**
 * Wraps the AI draft server action. Shared by the Dojo "Add problem" dialog and
 * the admin generate panel. Returns the draft so the caller can verify/fill.
 */
export function useDojoDraft() {
  const [draft, setDraft] = useState<DojoQuestionDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();

  async function generate(input: DraftInput): Promise<DojoQuestionDraft | null> {
    setGenerating(true);
    setError(undefined);
    const res = await generateDojoQuestionDraftAction(input);
    setGenerating(false);
    if (res.ok) {
      setDraft(res.data);
      return res.data;
    }
    setError(res.error);
    return null;
  }

  function reset() {
    setDraft(null);
    setError(undefined);
  }

  return { draft, generating, error, generate, reset };
}
