/**
 * Email Service — IndiePact
 *
 * Centralised email delivery for auth OTP codes. Uses Resend when
 * RESEND_API_KEY is set; falls back to Supabase's own mailer otherwise.
 *
 * To switch providers later, update `sendOtpEmail()` only — every call
 * site stays unchanged.
 *
 * Environment variables:
 *   RESEND_API_KEY          — Resend secret key (enables branded emails)
 *   AUTH_FROM_EMAIL         — e.g. "IndiePact <auth@indiepact.pro>"
 *                             Defaults to Resend sandbox address until a
 *                             verified domain is configured.
 *   SUPABASE_WEBHOOK_SECRET — HMAC secret shown by Supabase when you register
 *                             the /api/auth/email-hook as an Auth Hook.
 *                             Required to verify hook requests are genuine.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const RESEND_API = "https://api.resend.com/emails";

const FROM_FALLBACK = "IndiePact <onboarding@resend.dev>"; // Resend sandbox

// ─── Capability check ─────────────────────────────────────────────────────────

export function isEmailServiceReady(): boolean {
  return !!process.env["RESEND_API_KEY"];
}

// ─── OTP email ────────────────────────────────────────────────────────────────

/**
 * Sends a 6-digit OTP email via Resend.
 * The email contains ONLY the numeric code — no link, no button, no redirect.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const from = process.env["AUTH_FROM_EMAIL"] ?? FROM_FALLBACK;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `${otp} is your IndiePact code`,
      html: buildOtpHtml(otp),
      text: buildOtpText(otp),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ─── Auth Hook signature verification ─────────────────────────────────────────

/**
 * Verifies the HMAC-SHA256 signature Supabase attaches to every Auth Hook
 * request (x-supabase-signature header).
 *
 * Returns true when:
 *   - SUPABASE_WEBHOOK_SECRET is not set (verification disabled, warn in route)
 *   - Signature matches
 * Returns false when:
 *   - SUPABASE_WEBHOOK_SECRET is set AND signature does not match or is missing
 */
export function verifySupabaseHmac(
  rawBody: string,
  signature: string | undefined,
): boolean {
  const secret = process.env["SUPABASE_WEBHOOK_SECRET"];
  if (!secret) return true;
  if (!signature) return false;

  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  if (expected.length !== sigBuf.length) return false;

  return timingSafeEqual(expected, sigBuf);
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildOtpHtml(otp: string): string {
  const digits = otp.split("").join("</span>&thinsp;<span style=\"display:inline-block;\">");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Your IndiePact code</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:480px;width:100%;">
          <!-- Card -->
          <tr>
            <td style="background:#0d1a14;border:1px solid rgba(16,185,129,0.2);border-radius:16px;padding:40px 36px;">

              <!-- Logo row -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-bottom:32px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width:36px;height:36px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.28);border-radius:10px;text-align:center;vertical-align:middle;">
                          <span style="font-size:18px;line-height:36px;">🛡️</span>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">IndiePact</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <p style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Your verification code</p>
              <p style="color:#6b7280;font-size:14px;margin:0 0 28px;line-height:1.6;">
                Enter this 6-digit code in IndiePact to continue. It expires in 10&nbsp;minutes.
              </p>

              <!-- OTP box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:rgba(16,185,129,0.07);border:1.5px solid rgba(16,185,129,0.28);border-radius:12px;padding:24px;text-align:center;">
                    <span style="font-size:38px;font-weight:800;letter-spacing:10px;color:#10b981;font-family:'Courier New',Courier,monospace;">
                      <span style="display:inline-block;">${digits}</span>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr><td style="border-top:1px solid rgba(255,255,255,0.07);padding:28px 0 0;"></td></tr>
              </table>

              <!-- Footer note -->
              <p style="color:#4b5563;font-size:13px;margin:0;line-height:1.6;">
                If you didn't request this, you can safely ignore this email.
                Never share this code with anyone.
              </p>
              <p style="color:#374151;font-size:12px;margin:16px 0 0;">
                IndiePact &middot; AI Contract Protection
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpText(otp: string): string {
  return [
    "Your IndiePact verification code",
    "",
    `  ${otp}`,
    "",
    "Enter this code in IndiePact to continue.",
    "It expires in 10 minutes. Do not share it with anyone.",
    "",
    "If you didn't request this, ignore this email.",
    "",
    "— IndiePact · AI Contract Protection",
  ].join("\n");
}
