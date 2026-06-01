import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, profiles } from "@db";
import { requireAuth } from "@/lib/session";
import { Container } from "@/components/layout/Container";
import { parseStoredCv } from "@/lib/cv/parse";
import { type AtsReviewSnapshot } from "@/lib/cv/types";
import { CvWorkspace } from "@/components/cv/CvWorkspace";

export const metadata: Metadata = { title: "My CV" };

/**
 * /cv — render the stored CV, edit it, ATS-match against a job description,
 * and optimize it for that job. CV parsing & ATS scoring are in-app (no AI);
 * Groq is used only for qualitative suggestions and the rewrite.
 */
export default async function CvPage() {
  const user = await requireAuth();

  const [row] = await db
    .select({
      cvText: profiles.cvText,
      displayName: profiles.displayName,
      atsReview: profiles.atsReview,
      atsCvHash: profiles.atsCvHash,
      atsCheckedAt: profiles.atsCheckedAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  const initial = parseStoredCv(row?.cvText);
  // Seed the name from the profile if the CV didn't carry one.
  if (!initial.contact.name && row?.displayName) {
    initial.contact.name = row.displayName;
  }

  // Hydrate the last AI ATS review so the score shows on load (no AI call).
  const initialAts: AtsReviewSnapshot | null = row?.atsReview
    ? {
        review: row.atsReview,
        checkedAt: row.atsCheckedAt?.toISOString() ?? null,
        cvHash: row.atsCvHash ?? null,
      }
    : null;

  return (
    <Container className="py-10 sm:py-12">
      <CvWorkspace initial={initial} initialAts={initialAts} />
    </Container>
  );
}
