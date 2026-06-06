"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { stripCloze } from "@/lib/cloze";

/** No-op store subscription — support never changes within a session. */
const subscribeNoop = () => () => {};

/**
 * Strip Markdown to something a screen-reader voice can read cleanly: drop
 * syntax markers, read cloze answers, skip code blocks, keep link/heading text.
 */
function speakableText(md: string): string {
  return stripCloze(
    md.replace(/```[\s\S]*?```/g, ". code block. ").replace(/`([^`]+)`/g, "$1"),
  )
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#|]/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read a note aloud via the browser's Web Speech API (SpeechSynthesis). No AI /
 * network — it's a built-in. Renders nothing where the API is unavailable.
 */
export function ReadAloud({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  // SSR-safe capability check (false on the server, real value on the client).
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  // Stop speaking if the component unmounts (e.g. the note collapses).
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  const body = speakableText(text);

  function toggle() {
    const synth = window.speechSynthesis;
    synth.cancel(); // clear anything queued/playing first
    if (speaking) {
      setSpeaking(false);
      return;
    }
    if (!body) return;
    const utterance = new SpeechSynthesisUtterance(body);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!body}
      aria-label={speaking ? "Stop reading" : "Read aloud"}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        speaking
          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      {speaking ? (
        <Square className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}
