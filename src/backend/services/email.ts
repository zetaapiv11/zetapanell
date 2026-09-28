import { config } from '../config.js';
import { OtpPurpose } from '../db/types.js';

const SMTP2GO_SEND_URL = 'https://api.smtp2go.com/v3/email/send';

export class EmailError extends Error {}

export function isEmailConfigured(): boolean {
  return Boolean(config.smtp2goApiKey && config.smtp2goSender);
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends a transactional email through the SMTP2GO HTTP API
 * (https://developers.smtp2go.com/docs/send-an-email).
 *
 * Uses the HTTP API rather than SMTP relay on purpose: it needs no extra
 * dependency, and hosts like Render restrict outbound SMTP ports on some plans.
 *
 * When SMTP2GO isn't configured: in production this throws (so misconfiguration
 * is loud); in development the email is printed to the console instead so the
 * OTP flow can be tested without an SMTP2GO account.
 */
export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new EmailError('SMTP2GO_API_KEY / SMTP2GO_SENDER are not configured.');
    }
    console.warn(
      `[Email] SMTP2GO not configured -- printing instead of sending.\n` +
        `To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(SMTP2GO_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Smtp2go-Api-Key': config.smtp2goApiKey,
      },
      body: JSON.stringify({
        sender: config.smtp2goSender,
        to: [mail.to],
        subject: mail.subject,
        text_body: mail.text,
        html_body: mail.html,
      }),
      signal: controller.signal,
    });

    const body: any = await res.json().catch(() => null);
    const failed = Number(body?.data?.failed ?? 0);
    if (!res.ok || body?.data?.error || failed > 0) {
      console.error('[Email] SMTP2GO rejected the message:', res.status, JSON.stringify(body?.data ?? null));
      throw new EmailError('SMTP2GO rejected the message.');
    }
  } catch (err) {
    if (err instanceof EmailError) throw err;
    console.error('[Email] Failed to reach SMTP2GO:', err);
    throw new EmailError('Could not reach SMTP2GO.');
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOtpEmail(params: {
  panelName: string;
  purpose: OtpPurpose;
  code: string;
  ttlMinutes: number;
}): Pick<OutgoingEmail, 'subject' | 'text' | 'html'> {
  const { panelName, purpose, code, ttlMinutes } = params;
  const isReset = purpose === 'reset';

  const subject = isReset
    ? `${code} is your ${panelName} password reset code`
    : `${code} is your ${panelName} verification code`;
  const heading = isReset ? 'Reset your password' : 'Verify your email';
  const intro = isReset
    ? `Use this code to reset your ${panelName} password.`
    : `Use this code to finish creating your ${panelName} account.`;
  const outro = isReset
    ? "If you didn't request a password reset, you can ignore this email -- your password won't change."
    : "If you didn't try to sign up, you can safely ignore this email.";

  const text =
    `${heading}\n\n${intro}\n\nYour code: ${code}\n\n` +
    `It expires in ${ttlMinutes} minutes. Never share this code with anyone.\n\n${outro}\n`;

  const safeName = escapeHtml(panelName);
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#262626;">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;">
      <div style="font-size:13px;font-weight:bold;color:#2563eb;margin-bottom:12px;">${safeName}</div>
      <h1 style="font-size:20px;margin:0 0 12px;">${heading}</h1>
      <p style="font-size:14px;line-height:1.5;margin:0 0 20px;">${escapeHtml(intro)}</p>
      <div style="font-family:'Courier New',monospace;font-size:32px;letter-spacing:8px;font-weight:bold;text-align:center;background:#f0f4ff;border-radius:6px;padding:16px 0;margin-bottom:20px;">${code}</div>
      <p style="font-size:12px;line-height:1.5;color:#525252;margin:0 0 8px;">This code expires in ${ttlMinutes} minutes. Never share it with anyone.</p>
      <p style="font-size:12px;line-height:1.5;color:#737373;margin:0;">${escapeHtml(outro)}</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
