import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";
import { getQuestionBySlug } from "@/lib/dojo/queries";

/**
 * Deep-link compatibility: /dojo/[slug] confirms the problem is visible, then
 * redirects into the canonical editor-first workspace (/dojo?problem=slug).
 * Keeps shared/bookmarked links working with one solve surface.
 */
export default async function DojoSolvePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireAuth();
  const { slug } = await params;
  const question = await getQuestionBySlug(slug, user.id);
  if (!question) notFound();
  redirect(`/dojo?problem=${encodeURIComponent(slug)}`);
}
