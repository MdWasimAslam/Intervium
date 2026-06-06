"use server";

import { z } from "zod";
import { isDemoAccessEnabled } from "@/lib/demo";
import { recordDemoRequest } from "@/lib/demo-analytics";
import { sendDemoInvite } from "@/lib/email";
import { allowAction, peekAction } from "@/lib/rate-limit";
import type { Result } from "@/lib/actions/result";

const schema = z.object({ email: z.string().email().max(200) });

/**
 * Public landing-page action: a visitor enters their email and we send them the
 * shared demo account's credentials. Gated by the admin "demo access" toggle and
 * rate-limited (per-email + a global cap) since it's unauthenticated. It only
 * ever emails the fixed, benign demo credentials — no per-user data.
 */
export async function requestDemoAccessAction(
  input: unknown,
): Promise<Result<true>> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Enter a valid email address." };

  if (!(await isDemoAccessEnabled())) {
    return {
      ok: false,
      error: "Demo access isn't available right now — please check back later.",
    };
  }

  const email = p.data.email.trim().toLowerCase();
  // In-memory throttle (resets on cold start): a few per email, plus a global
  // cap so the unauthenticated endpoint can't be used to blast mail.
  //   - global cap is CONSUMED up front (anti-blast must gate before sending);
  //   - per-email is only PEEKED here and consumed after a successful send, so
  //     a transient send failure doesn't lock a legitimate visitor out for 10
  //     minutes without ever delivering their credentials.
  const PER_EMAIL_KEY = `demo-req:${email}`;
  if (
    !peekAction(PER_EMAIL_KEY, 2, 10 * 60_000) ||
    !allowAction("demo-req:global", 40, 60_000)
  ) {
    return {
      ok: false,
      error: "Too many requests right now — please try again shortly.",
    };
  }

  const error = await sendDemoInvite(email);
  if (error) return { ok: false, error };

  // Delivered: now count it against the per-email budget and record the
  // interest. Never let an analytics write block access.
  allowAction(PER_EMAIL_KEY, 2, 10 * 60_000);
  await recordDemoRequest(email);
  return { ok: true, data: true };
}
