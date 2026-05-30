import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { allowAction } from "@/lib/rate-limit";

/**
 * POST /api/transcribe
 *
 * Server-side transcription for the "whisper" provider. Two backends:
 *  - If GROQ_API_KEY is set → Groq Whisper (hosted, fast, works on Vercel).
 *  - Otherwise → local whisper.cpp via nodejs-whisper (offline dev, no key).
 *
 * Both are reached by the same record→POST flow and neither depends on the
 * browser Web Speech backend. The default "webspeech" provider never calls
 * this. The local fallback is dynamically imported so its native binary is
 * never loaded on serverless platforms where GROQ_API_KEY is configured.
 */
export const runtime = "nodejs";
// Hosted/local transcription can take a few seconds; stay under the Vercel limit.
export const maxDuration = 60;

// Groq's fast multilingual Whisper model (free tier).
const GROQ_MODEL = "whisper-large-v3-turbo";
// Local fallback model (~142MB), auto-downloaded on first use.
const LOCAL_MODEL = "base";

async function transcribeWithGroq(apiKey: string, audio: File): Promise<string> {
  const form = new FormData();
  form.append("file", audio, audio.name || "answer.webm");
  form.append("model", GROQ_MODEL);
  form.append("response_format", "json");

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[transcribe] groq error", res.status, detail.slice(0, 300));
    throw new Error(`groq ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Strip whisper-cli's `[00:00:00.000 --> …]` timestamps to plain text. */
function parseLocalTranscript(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*\[[0-9:.\s\->]+\]\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function transcribeLocally(audio: File): Promise<string> {
  // Lazy imports: keep the native package out of bundles that never use it.
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { default: path } = await import("node:path");
  const { nodewhisper } = await import("nodejs-whisper");

  const dir = await mkdtemp(path.join(tmpdir(), "intervium-stt-"));
  try {
    const inputPath = path.join(dir, "answer.webm");
    await writeFile(inputPath, Buffer.from(await audio.arrayBuffer()));
    const raw = await nodewhisper(inputPath, {
      modelName: LOCAL_MODEL,
      autoDownloadModelName: LOCAL_MODEL,
      removeWavFileAfterTranscription: true,
      whisperOptions: { outputInText: false },
    });
    return parseLocalTranscript(String(raw));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!allowAction(`transcribe:${user.id}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many transcription requests. Please slow down." },
      { status: 429 },
    );
  }

  let audio: File | null = null;
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (file instanceof File) audio = file;
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  try {
    const text = apiKey
      ? await transcribeWithGroq(apiKey, audio)
      : await transcribeLocally(audio);
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[transcribe]", error);
    return NextResponse.json(
      { error: "Transcription failed." },
      { status: 500 },
    );
  }
}
