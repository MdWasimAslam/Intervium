import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Small filesystem/runtime helpers shared by the check modules. All reads are
 * best-effort: they return null/"unknown" rather than throwing, because source
 * files may not be present in a serverless bundle.
 */

export function projectRoot(): string {
  return process.cwd();
}

/** Read a file relative to the project root; null if unreadable. */
export function readProjectFile(relPath: string): string | null {
  try {
    return readFileSync(join(projectRoot(), relPath), "utf8");
  } catch {
    return null;
  }
}

/** Parse a JSON file relative to the project root; null if missing/invalid. */
export function readJsonSafe<T = unknown>(relPath: string): T | null {
  const raw = readProjectFile(relPath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** The app version from package.json, or "unknown". */
export function appVersion(): string {
  const pkg = readJsonSafe<{ version?: string }>("package.json");
  return pkg?.version ?? "unknown";
}

/** The installed Next.js version, or "unknown". */
export function nextVersion(): string {
  const pkg = readJsonSafe<{ version?: string }>(
    "node_modules/next/package.json",
  );
  return pkg?.version ?? "unknown";
}

/**
 * Best-effort git commit hash: prefer the platform-injected env var, fall back
 * to reading `.git/HEAD` (works locally), else "unknown".
 */
export function gitCommit(): string {
  const fromEnv =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    process.env.COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 12);

  const head = readProjectFile(".git/HEAD")?.trim();
  if (!head) return "unknown";
  if (!head.startsWith("ref:")) return head.slice(0, 12); // detached HEAD
  const ref = head.replace("ref:", "").trim();
  const sha = readProjectFile(`.git/${ref}`)?.trim();
  return sha ? sha.slice(0, 12) : "unknown";
}

export function nodeEnv(): string {
  return process.env.NODE_ENV ?? "unknown";
}
