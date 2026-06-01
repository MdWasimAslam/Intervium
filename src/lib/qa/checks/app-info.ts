import "server-only";
import type { SectionOutput } from "../types";
import {
  appVersion,
  gitCommit,
  nextVersion,
  nodeEnv,
  readJsonSafe,
} from "./shared";

/**
 * §1 Application Information — informational only (unscored). Browser info is
 * added client-side; the server contributes everything it can read locally.
 */
export function checkAppInfo(): SectionOutput {
  const buildTimestamp =
    process.env.BUILD_TIMESTAMP ??
    process.env.VERCEL_GIT_COMMIT_DATE ??
    "unknown (set BUILD_TIMESTAMP at build time)";

  const reactVersion =
    readJsonSafe<{ version?: string }>("node_modules/react/package.json")
      ?.version ?? "unknown";

  return {
    note: "Informational only — these values do not affect the health score.",
    checks: [
      { id: "app-version", label: "App version", status: "pass", detail: appVersion() },
      { id: "commit", label: "Git commit", status: "pass", detail: gitCommit() },
      { id: "environment", label: "Environment", status: "pass", detail: nodeEnv() },
      { id: "build-timestamp", label: "Build timestamp", status: "pass", detail: buildTimestamp },
      { id: "node-version", label: "Node version", status: "pass", detail: process.version },
      { id: "next-version", label: "Next.js version", status: "pass", detail: nextVersion() },
      { id: "react-version", label: "React version", status: "pass", detail: reactVersion },
      {
        id: "runtime",
        label: "Server runtime",
        status: "pass",
        detail: process.env.NEXT_RUNTIME ?? "nodejs",
      },
    ],
  };
}
