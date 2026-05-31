"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Transcription,
  TranscriptionStatus,
  UseTranscriptionOptions,
} from "./types";

/**
 * Server-side transcription provider. Records the answer with MediaRecorder,
 * then POSTs the audio blob to /api/transcribe (Groq Whisper, or local
 * whisper.cpp in dev). No live interim text: onTranscript fires once after the
 * recording is transcribed.
 *
 * Microphone handling: every stream ever opened is tracked, and the mic is
 * released **synchronously** on stop (and on the next start, and on unmount) —
 * not deferred to MediaRecorder's async `onstop` — so the browser's "tab is
 * using your microphone" indicator turns off the instant you press stop.
 * Stopping the track still flushes the buffered audio, so the transcript is
 * preserved. Selected when the admin Transcription provider is "whisper".
 */
export function useServerTranscription({
  onTranscript,
}: UseTranscriptionOptions): Transcription {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [recording, setRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Every stream we've opened — so we can guarantee none is left live.
  const streamsRef = useRef<Set<MediaStream>>(new Set());
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  /** Stop every track on every open stream → releases the mic immediately. */
  const stopMic = useCallback(() => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current.clear();
  }, []);

  const stopRecorder = useCallback(() => {
    const r = recorderRef.current;
    try {
      if (r && r.state !== "inactive") r.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("unsupported");
      return;
    }

    // Tear down anything left from a previous attempt before re-opening the mic.
    stopRecorder();
    stopMic();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("denied");
      setRecording(false);
      return;
    }

    streamsRef.current.add(stream);
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Belt-and-suspenders: ensure this session's tracks are stopped.
      stream.getTracks().forEach((t) => t.stop());
      streamsRef.current.delete(stream);

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
  }, [stopMic, stopRecorder]);

  const stop = useCallback(() => {
    // Flush the recorder (fires onstop → transcription) AND release the mic
    // synchronously so the indicator clears immediately.
    stopRecorder();
    stopMic();
    setRecording(false);
  }, [stopMic, stopRecorder]);

  const reset = useCallback(() => {
    chunksRef.current = [];
  }, []);

  // Release the mic on unmount (e.g. navigating to the results page).
  useEffect(() => {
    return () => {
      stopRecorder();
      stopMic();
    };
  }, [stopRecorder, stopMic]);

  return { status, recording, start, stop, reset };
}
