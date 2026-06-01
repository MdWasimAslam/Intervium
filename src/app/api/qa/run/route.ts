import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isQaEnabled } from "@/lib/qa/access";
import { runAudit } from "@/lib/qa/run";
import type { SectionId } from "@/lib/qa/types";

/**
 * POST /api/qa/run — execute QA checks and return a QaReport.
 *
 * Middleware does NOT run on /api/*, so this self-guards: admin-only, and only
 * when the dashboard is enabled. Returns clean status codes (not redirects) so
 * the client fetch can react. Always Node runtime (DB + fs access) and never
 * cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RunBody {
  sections?: SectionId[];
  liveProbe?: boolean;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isQaEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: RunBody = {};
  try {
    body = (await req.json()) as RunBody;
  } catch {
    // No/invalid body → run everything with defaults.
  }

  const report = await runAudit({
    sections: Array.isArray(body.sections) ? body.sections : undefined,
    liveProbe: Boolean(body.liveProbe),
    baseUrl: new URL(req.url).origin,
  });

  return NextResponse.json(report);
}
