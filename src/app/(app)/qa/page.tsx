import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { requireQaAccess } from "@/lib/qa/access";
import { QaDashboard } from "@/components/qa/QaDashboard";

export const metadata: Metadata = { title: "Production QA Center" };
// Always run fresh — the audit reflects live system state.
export const dynamic = "force-dynamic";

/**
 * Developer-only Production Readiness Dashboard.
 *
 * Gated by {@link requireQaAccess} (admin role + QA_DASHBOARD_ENABLED). Every
 * check is deterministic and AI-free; the work happens in the QaDashboard
 * client component via POST /api/qa/run.
 */
export default async function QaPage() {
  await requireQaAccess();

  return (
    <Container className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Production QA Center
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Deterministic production-readiness checks — no AI, no token spend.
          Validate environment, database, integrations, routes, and the ATS &
          interview engines before deploying.
        </p>
      </div>
      <QaDashboard />
    </Container>
  );
}
