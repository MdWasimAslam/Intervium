"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Transcription,
  TranscriptionStatus,
  UseTranscriptionOptions,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Minimal Web Speech API typings (not in the default TS DOM lib).            */
/* -------------------------------------------------------------------------- */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Detach handlers and abort an instance so it can never restart itself. */
function retire(recognition: SpeechRecognitionLike | null) {
  if (!recognition) return;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.abort();
  } catch {
    /* ignore */
  }
}

// Errors that mean we genuinely can't record — don't try to restart on these.
const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
]);

// If recognition keeps ending without ever producing text (e.g. the speech
// service is unreachable), stop restarting and fall back to typing instead of
// looping forever.
const MAX_NO_PROGRESS = 4;

/**
 * Web Speech API transcription (default provider). Runs entirely client-side
 * with live interim results — no server call, no key.
 *
 * Chrome's recognizer ends a session on its own after a short pause in speech
 * (even with `continuous = true`). Left alone that flips the UI back to "not
 * recording" mid-answer. To keep one press-to-record session alive we restart
 * recognition whenever it ends — but ONLY the instance that is still the
 * active one (`recognitionRef`). Retired instances have their handlers detached
 * so an old recognizer can't restart itself and fight the new one.
 */
export function useWebSpeech({
  onTranscript,
}: UseTranscriptionOptions): Transcription {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [recording, setRecording] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  // True while the user intends to be recording — drives the auto-restart.
  const keepAliveRef = useRef(false);
  // True once stop() has been requested: suppresses further onTranscript emits
  // so we don't clobber manual textarea edits made after stopping.
  const stoppingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }

    // Retire any previous instance so it can't keep restarting in parallel.
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    retire(recognitionRef.current);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    finalRef.current = "";
    stoppingRef.current = false;

    // Only the live instance is allowed to act on its events.
    const isActive = () => recognitionRef.current === recognition;

    // Per-session progress tracking (persists across silent auto-restarts).
    let sawResult = false;
    let noProgress = 0;

    const restart = () => {
      sawResult = false;
      try {
        recognition.start();
      } catch {
        // Chrome can reject an immediate restart; retry once shortly.
        restartTimerRef.current = setTimeout(() => {
          if (!keepAliveRef.current || !isActive()) return;
          try {
            recognition.start();
          } catch {
            keepAliveRef.current = false;
            setRecording(false);
            setStatus((s) => (s === "recording" ? "idle" : s));
          }
        }, 300);
      }
    };

    recognition.onresult = (event) => {
      sawResult = true;
      noProgress = 0;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += result[0].transcript + " ";
        else interim += result[0].transcript;
      }
      // Once stop() has been requested, don't keep pushing text — a late
      // result would otherwise overwrite manual edits to the textarea.
      if (stoppingRef.current) return;
      onTranscriptRef.current((finalRef.current + interim).trim());
    };

    recognition.onerror = (e) => {
      if (FATAL_ERRORS.has(e.error)) {
        keepAliveRef.current = false;
        setStatus(e.error === "audio-capture" ? "error" : "denied");
        setRecording(false);
      }
      // Non-fatal (e.g. "no-speech", "aborted", "network") → onend handles it.
    };

    recognition.onend = () => {
      // Ignore events from a retired instance entirely.
      if (!isActive()) return;
      if (!keepAliveRef.current) {
        setRecording(false);
        return;
      }
      // Give up (and let the user type) if we keep ending without any
      // transcript — e.g. the speech service is unreachable — rather than
      // restarting forever.
      noProgress = sawResult ? 0 : noProgress + 1;
      if (noProgress >= MAX_NO_PROGRESS) {
        keepAliveRef.current = false;
        setRecording(false);
        setStatus("error");
        return;
      }
      restart();
    };

    recognitionRef.current = recognition;
    keepAliveRef.current = true;
    try {
      recognition.start();
      setStatus("recording");
      setRecording(true);
    } catch {
      keepAliveRef.current = false;
      setStatus("error");
      setRecording(false);
    }
  }, []);

  const stop = useCallback((): Promise<string> => {
    keepAliveRef.current = false;
    stoppingRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    setRecording(false);
    setStatus((s) => (s === "recording" ? "idle" : s));
    // Web Speech has already emitted finalized text live; resolve with it so
    // callers can treat stop() uniformly with the server provider.
    return Promise.resolve(finalRef.current.trim());
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
  }, []);

  // Tear down on unmount so recognition can't keep restarting after navigation.
  useEffect(() => {
    return () => {
      keepAliveRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      retire(recognitionRef.current);
      recognitionRef.current = null;
    };
  }, []);

  return { status, recording, start, stop, reset };
}
