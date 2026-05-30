"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Transcription,
  TranscriptionStatus,
  UseTranscriptionOptions,
} from "./types";

/**
 * Server-side transcription provider. Records the answer with MediaRecorder,
 * then POSTs the audio blob to /api/transcribe (which runs whisper.cpp locally
 * — no API key, no external speech service). No live interim text: onTranscript
 * fires once after the recording is transcribed.
 *
 * Selected when the admin Transcription provider is set to "whisper".
 */
export function useServerTranscription({
  onTranscript,
}: UseTranscriptionOptions): Transcription {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [recording, setRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  const start = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) {
          setStatus("idle");
          return;
        }
        setStatus("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "answer.webm");
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });
          const json = await res.json();
          if (res.ok && typeof json.text === "string") {
            onTranscriptRef.current(json.text.trim());
            setStatus("idle");
          } else {
            setStatus("error");
          }
        } catch {
          setStatus("error");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setRecording(true);
    } catch {
      setStatus("denied");
      setRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    chunksRef.current = [];
  }, []);

  return { status, recording, start, stop, reset };
}
