"use client";

import type { Transcription, UseTranscriptionOptions } from "./types";
import { useWebSpeech } from "./useWebSpeech";
import { useServerTranscription } from "./useServerTranscription";

export type TranscriptionProvider = "webspeech" | "whisper";

/**
 * Selects the transcription provider at runtime (driven by admin Settings).
 *
 * Both provider hooks are called unconditionally (rules-of-hooks safe); only
 * the selected one's controls are returned. Each hook just allocates
 * state/refs until start() is invoked, so this is cheap.
 *
 * - "webspeech": live in-browser Web Speech API (needs Google's backend).
 * - "whisper":   record + transcribe server-side with local whisper.cpp.
 */
export function useTranscription(
  provider: TranscriptionProvider,
  opts: UseTranscriptionOptions,
): Transcription {
  const web = useWebSpeech(opts);
  const server = useServerTranscription(opts);
  return provider === "whisper" ? server : web;
}

export type { Transcription } from "./types";
