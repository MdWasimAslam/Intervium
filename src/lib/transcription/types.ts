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
  /**
   * Stop recording and resolve with the final transcript once it is available.
   * For server transcription this resolves after the audio has been POSTed and
   * transcribed; for Web Speech it resolves with the current finalized text.
   * Resolves with "" if nothing was captured or transcription failed.
   */
  stop: () => Promise<string>;
  reset: () => void;
}

export type UseTranscription = (opts: UseTranscriptionOptions) => Transcription;
