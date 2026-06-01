import "server-only";
import { type Dirent, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, RunContext, SectionOutput } from "../types";
import { projectRoot, readProjectFile } from "./shared";

/**
 * §6 Application Route Audit.
 *
 * Static (always): walk src/app, enumerate page/route modules, and verify each
 * declares the export Next requires (default export for pages, an HTTP method
 * for route handlers). This is deterministic and needs no running server — it's
 * also the basis of the "Build" overview chip.
 *
 * Live (optional): when liveProbe + a baseUrl are set, GET each static page
 * route and flag 5xx. Auth redirects (3xx) and 4xx are not treated as crashes.
 */

const APP_DIR = "src/app";
const PAGE_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);
const ROUTE_FILES = new Set(["route.ts", "route.js"]);
const HTTP_METHOD_RE = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;

/**
 * True if a route module exports at least one HTTP handler. Handles every
 * common form: `export function GET`, `export const GET =`, the destructured
 * `export const { GET, POST } = handlers` (Auth.js), and `export { GET, POST }`.
 */
function exportsHttpHandler(src: string): boolean {
  return /\bexport\b/.test(src) && HTTP_METHOD_RE.test(src);
}

/** Known routes used when the source tree isn't on disk (prod serverless). */
const FALLBACK_ROUTES = [
  "/",
  "/login",
  "/register",
  "/dashboard",
  "/interview/new",
  "/history",
  "/cv",
  "/profile",
  "/admin",
];

interface DiscoveredRoute {
  /** URL path with route groups stripped and [params] shown as :param. */
  urlPath: string;
  /** File path relative to project root. */
  file: string;
  kind: "page" | "route";
  dynamic: boolean;
}

function walk(absDir: string, relDir: string, out: { abs: string; rel: string; name: string }[]) {
  let entries: Dirent<string>[];
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(absDir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walk(abs, rel, out);
    } else {
      out.push({ abs, rel, name: entry.name });
    }
  }
}

function toUrlPath(relFromApp: string): { urlPath: string; dynamic: boolean } {
  const dir = relFromApp.split("/").slice(0, -1); // drop the filename
  const kept: string[] = [];
  let dynamic = false;
  for (const seg of dir) {
    if (/^\(.*\)$/.test(seg)) continue; // route group — not part of the URL
    if (/^\[.*\]$/.test(seg)) dynamic = true;
    kept.push(seg.replace(/^\[(\.\.\.)?(.+)\]$/, ":$2"));
  }
  return { urlPath: "/" + kept.join("/"), dynamic };
}

function discover(): DiscoveredRoute[] | null {
  const files: { abs: string; rel: string; name: string }[] = [];
  walk(join(projectRoot(), APP_DIR), "", files);
  if (files.length === 0) return null; // tree not on disk

  const routes: DiscoveredRoute[] = [];
  for (const f of files) {
    const isPage = PAGE_FILES.has(f.name);
    const isRoute = ROUTE_FILES.has(f.name);
    if (!isPage && !isRoute) continue;
    const { urlPath, dynamic } = toUrlPath(f.rel);
    routes.push({
      urlPath: urlPath === "/" ? "/" : urlPath.replace(/\/$/, ""),
      file: `${APP_DIR}/${f.rel}`,
      kind: isPage ? "page" : "route",
      dynamic,
    });
  }
  return routes;
}

async function probe(baseUrl: string, urlPath: string): Promise<number | string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(new URL(urlPath, baseUrl), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return res.status;
  } catch (error) {
    return error instanceof Error ? error.message : "fetch failed";
  } finally {
    clearTimeout(timer);
  }
}

export async function checkRoutes(ctx: RunContext): Promise<SectionOutput> {
  const checks: CheckResult[] = [];
  const routes = discover();

  if (!routes) {
    return {
      note: "Source tree not readable here (typical in serverless). Using a known route manifest; enable live probing for runtime checks.",
      checks: FALLBACK_ROUTES.map((p) => ({
        id: `manifest-${p}`,
        label: p,
        status: "skip" as const,
        detail: "Listed from manifest (static scan unavailable)",
      })),
    };
  }

  // Static export integrity.
  let broken = 0;
  for (const r of routes.sort((a, b) => a.urlPath.localeCompare(b.urlPath))) {
    const src = readProjectFile(r.file) ?? "";
    const ok =
      r.kind === "page"
        ? /export\s+default/.test(src)
        : exportsHttpHandler(src);
    if (!ok) broken++;
    checks.push({
      id: `static-${r.file}`,
      label: `${r.urlPath}${r.dynamic ? " (dynamic)" : ""}`,
      status: ok ? "pass" : "fail",
      detail: ok
        ? r.kind === "page"
          ? "page · default export found"
          : "route · HTTP handler found"
        : r.kind === "page"
          ? "missing default export"
          : "no HTTP method exported",
      recommendation: ok
        ? undefined
        : `Fix the export in ${r.file} — it will fail to build/render.`,
    });
  }

  // Optional live probe of static page routes.
  if (ctx.liveProbe && ctx.baseUrl) {
    const probeable = routes.filter((r) => r.kind === "page" && !r.dynamic);
    const results = await Promise.all(
      probeable.map(async (r) => ({ r, status: await probe(ctx.baseUrl!, r.urlPath) })),
    );
    for (const { r, status } of results) {
      if (typeof status === "string") {
        checks.push({
          id: `probe-${r.urlPath}`,
          label: `GET ${r.urlPath}`,
          status: "warning",
          detail: `Probe error: ${status}`,
        });
      } else {
        const failed = status >= 500;
        checks.push({
          id: `probe-${r.urlPath}`,
          label: `GET ${r.urlPath}`,
          status: failed ? "fail" : "pass",
          detail:
            status >= 300 && status < 400
              ? `HTTP ${status} (redirect — likely auth gate)`
              : `HTTP ${status}`,
          recommendation: failed
            ? `${r.urlPath} returns a server error — investigate the page.`
            : undefined,
        });
      }
    }
  } else {
    checks.push({
      id: "probe-info",
      label: "Live route probing",
      status: "skip",
      detail: `${broken === 0 ? "Static integrity OK" : `${broken} broken export(s)`} · enable 'Live probes' to GET each route`,
    });
  }

  return { checks };
}
