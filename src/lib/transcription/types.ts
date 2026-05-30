/** Recording/permission status surfaced to the UI. */
export type TranscriptionStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "denied"
  | "unsupported"
  | "error";

export interface UseTranscriptionOptions {
  /**
   * Called as transcript text becomes available. For Web Speech this fires
   * live (interim + final); for Groq it fires once after transcription.
   */
  onTranscript: (text: string) => void;
}

export interface Transcription {
  status: TranscriptionStatus;
  recording: boolean;
  start: () => Promise<void> | void;
  stop: () => void;
  reset: () => void;
}

export type UseTranscription = (opts: UseTranscriptionOptions) => Transcription;
