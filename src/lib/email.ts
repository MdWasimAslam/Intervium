import "server-only";
import { DEMO_ACCESS_KEY, DEMO_AI_MESSAGE, DEMO_USER_EMAIL } from "@/lib/demo";

/**
 * Minimal transactional email via Resend's REST API — no SDK dependency.
 * Returns `null` on success, or a user-safe error message string.
 */
async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return "Email isn't configured (missing RESEND_API_KEY).";
  // Use a verified sender via DEMO_INVITE_FROM in prod; Resend's test sender
  // (onboarding@resend.dev) only delivers to your own account in dev.
  const from =
    process.env.DEMO_INVITE_FROM?.trim() || "Intervium <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] Resend error:", res.status, detail.slice(0, 300));
      return "The email service rejected the request.";
    }
    return null;
  } catch (error) {
    console.error("[email] send failed:", error);
    return "Could not reach the email service.";
  }
}

/**
 * Email the shared demo credentials (email + access key + sign-in link) to
 * someone you want to show the app to. Uses the canonical demo identity from
 * `@/lib/demo` (which applies the AI/delete locks), so an invite can never hand
 * out an unrecognized — and therefore unlocked — account: if `DEMO_USER_EMAIL`
 * isn't configured, there is no locked demo account to invite anyone to.
 */
export async function sendDemoInvite(to: string): Promise<string | null> {
  if (!DEMO_USER_EMAIL) {
    return "Demo account isn't configured (set DEMO_USER_EMAIL).";
  }
  const email = DEMO_USER_EMAIL;
  const key = DEMO_ACCESS_KEY;
  const url = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "'SF Mono',ui-monospace,Menlo,Consolas,monospace";

  const cred = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f0;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#5b6b66;">${label}</div>
        <div style="margin-top:3px;font-family:${mono};font-size:15px;color:#0a0f0d;">${value}</div>
      </td>
    </tr>`;

  const html = `
  <div style="margin:0;padding:0;background:#eef1f0;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;font-family:${font};">
      <div style="background:#ffffff;border:1px solid #e6eae8;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px -16px rgba(0,0,0,0.18);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#00b775 0%,#0a8a5f 55%,#046a47 100%);padding:30px 32px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">Intervium</div>
          <div style="margin-top:4px;font-size:13px;color:rgba(255,255,255,0.88);">AI-powered interview practice</div>
        </div>
        <!-- Body -->
        <div style="padding:30px 32px;">
          <h1 style="margin:0 0 8px;font-size:21px;font-weight:700;color:#0a0f0d;">Your demo access is ready 🎉</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#5b6b66;">
            Sign in with the credentials below to explore Intervium — a fully-loaded demo account with sample interviews, notes, and practice data. No signup needed.
          </p>
          <!-- Credentials card -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f8f7;border:1px solid #e6eae8;border-radius:14px;padding:6px 18px;margin-bottom:24px;">
            ${cred("Email", email)}
            ${cred("Password", key)}
          </table>
          <!-- CTA -->
          <a href="${url}/login" style="display:inline-block;background:#00b775;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:11px;">
            Sign in to the demo &nbsp;&rarr;
          </a>
          <p style="margin:22px 0 0;font-size:12.5px;line-height:1.65;color:#8a9994;">
            Heads up: ${DEMO_AI_MESSAGE} Everything else is pre-populated so you can see exactly how the app works.
          </p>
        </div>
      </div>
      <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#9aa8a3;">
        © Intervium · You received this because someone requested demo access for this address.
      </p>
    </div>
  </div>`;

  return sendEmail({ to, subject: "Your Intervium demo login", html });
}
