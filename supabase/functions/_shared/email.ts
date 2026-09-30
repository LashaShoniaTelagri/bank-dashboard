// Outbound email via Resend (https://api.resend.com/emails).
//
// Replaced SendGrid v3 — no dynamic templates, categories or tracking settings
// were in use, so the payload is a flat {from, to, subject, html, text}.
//
// Resend does not rewrite links by default, so there is no click-tracking
// opt-out to send: invite and password-reset URLs keep their auth tokens intact.

const RESEND_API_URL = "https://api.resend.com/emails";
const API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@telagri.com";
const DEFAULT_FROM_NAME = "TelAgri Platform";

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** Distinguishes "no API key" from a delivery failure — notifiers skip, auth flows throw. */
  notConfigured?: boolean;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
}

/**
 * Send one email. Never throws on a delivery failure — returns {ok: false} so
 * each caller decides whether that is fatal.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  if (!API_KEY) {
    return { ok: false, notConfigured: true, error: "RESEND_API_KEY not configured" };
  }

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const payload = {
    from: `${opts.fromName ?? DEFAULT_FROM_NAME} <${FROM_EMAIL}>`,
    to: recipients,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
  };

  console.log(`📧 Sending via Resend to ${recipients.length} recipient(s): ${opts.subject}`);

  let response: Response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Resend request failed:", error);
    return { ok: false, error };
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend error:", response.status, errorText);
    return { ok: false, error: `Resend error: ${response.status} ${errorText}` };
  }

  const { id } = await response.json().catch(() => ({ id: undefined }));
  console.log(`✅ Resend accepted message${id ? ` (${id})` : ""}`);
  return { ok: true, id };
}
