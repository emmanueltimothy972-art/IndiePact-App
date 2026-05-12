/**
 * Auth routes — IndiePact API
 *
 * POST /api/auth/otp/send
 *   Sends a 6-digit verification code to the user's email.
 *   Two paths depending on configuration:
 *
 *   Path A — RESEND_API_KEY is set (recommended, production-ready):
 *     1. Ensure user exists in Supabase Auth with email confirmed.
 *     2. Call admin.generateLink() to get the OTP token WITHOUT sending any email.
 *     3. Send a branded email via Resend containing ONLY the 6-digit code.
 *        → User never sees "Follow this link" or a magic link.
 *
 *   Path B — no RESEND_API_KEY (temporary fallback):
 *     1. Ensure user exists and email is confirmed.
 *     2. Call signInWithOtp() — Supabase sends its default email.
 *        The email uses the "Magic Link" template until the template is updated
 *        in Supabase Dashboard → Auth → Email Templates → Magic Link.
 *
 * POST /api/auth/email-hook
 *   Supabase Auth "Send Email" Hook endpoint.
 *   When registered in Supabase Dashboard (Auth → Hooks → Send Email),
 *   Supabase POSTs here for every auth email instead of sending its own.
 *   This hook sends a branded IndiePact email via Resend with only the OTP code.
 *
 *   Registration steps (after RESEND_API_KEY is set):
 *     1. Supabase Dashboard → Authentication → Hooks → Add Hook
 *     2. Hook type: "Send Email"
 *     3. URL: https://<your-api-domain>/api/auth/email-hook
 *     4. Copy the generated HMAC secret → set as SUPABASE_WEBHOOK_SECRET env var
 */

import { Router } from "express";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabase } from "../lib/supabase.js";
import {
  isEmailServiceReady,
  sendOtpEmail,
  verifySupabaseHmac,
} from "../services/email.js";
import type { Logger } from "pino";

const router = Router();

const SendOtpSchema = z.object({ email: z.string().email() });

// ─── Helper: ensure user exists and email is confirmed ────────────────────────

/**
 * Guarantees the Supabase Auth account exists with email_confirmed_at set.
 *
 * Why this matters:
 *   When signInWithOtp() is called on an unconfirmed account — even with OTP
 *   mode enabled in the Supabase dashboard — Supabase sends the "Confirm signup"
 *   email ("Follow this link to confirm your user") instead of the OTP email.
 *   Pre-confirming every account before triggering any email eliminates this.
 *
 * Strategy:
 *   1. admin.createUser({ email_confirm: true }) — instant for new users.
 *      No email is sent by this call.
 *   2. If user already exists, page through listUsers to find them and call
 *      updateUserById({ email_confirm: true }) if they are unconfirmed.
 */
async function ensureUserConfirmed(
  admin: SupabaseClient,
  email: string,
  log: Logger,
): Promise<void> {
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!createErr) {
    log.info({ email }, "New user created with email pre-confirmed");
    return;
  }

  log.info({ email, errMsg: createErr.message }, "createUser failed — finding existing user");

  const PER_PAGE = 50;
  let page = 1;

  while (true) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (listErr) {
      log.warn({ err: listErr, email }, "listUsers error while finding user");
      break;
    }

    const users = data?.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === email);

    if (found) {
      if (!found.email_confirmed_at) {
        log.info({ userId: found.id, email }, "Confirming existing unconfirmed user");
        const { error: updateErr } = await admin.auth.admin.updateUserById(found.id, {
          email_confirm: true,
        });
        if (updateErr) {
          log.warn({ err: updateErr, userId: found.id }, "updateUserById warning — continuing");
        }
      } else {
        log.info({ userId: found.id, email }, "Existing user already confirmed");
      }
      return;
    }

    if (users.length < PER_PAGE) {
      log.warn({ email }, "User not found in listUsers — proceeding anyway");
      break;
    }

    page++;
  }
}

// ─── POST /api/auth/otp/send ──────────────────────────────────────────────────

router.post("/auth/otp/send", async (req, res) => {
  const parse = SendOtpSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const email = parse.data.email.toLowerCase().trim();
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ error: "Email service is not configured." });
  }

  try {
    const admin = requireSupabase();

    // Step 1 — Guarantee account exists and is email-confirmed.
    await ensureUserConfirmed(admin, email, req.log as Logger);

    if (isEmailServiceReady()) {
      // ── Path A: Resend is configured ─────────────────────────────────────
      // generateLink() returns the OTP token WITHOUT sending any email.
      // We send our own branded email containing ONLY the 6-digit code.
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkErr || !linkData?.properties?.email_otp) {
        req.log.error({ err: linkErr, email }, "generateLink failed");
        return res.status(500).json({ error: "Could not generate verification code. Please try again." });
      }

      const otp = linkData.properties.email_otp;
      await sendOtpEmail(email, otp);
      req.log.info({ email }, "OTP email sent via Resend (Path A)");
    } else {
      // ── Path B: Fallback — Supabase sends its own email ──────────────────
      // Note: Supabase's default email uses the "Magic Link" template and
      // will say "Follow this link to login". To display a clean 6-digit-only
      // code without Resend, update the Magic Link template in:
      // Supabase Dashboard → Authentication → Email Templates → Magic Link
      // and change the button/link text to show {{ .Token }} instead.
      req.log.info({ email }, "RESEND_API_KEY not set — falling back to Supabase email (Path B)");

      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error: otpErr } = await anonClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (otpErr) {
        req.log.error({ err: otpErr, email }, "signInWithOtp failed");
        return res.status(500).json({ error: "Could not send the verification code. Please try again." });
      }

      req.log.info({ email }, "OTP dispatched via Supabase fallback (Path B)");
    }

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err, email }, "OTP send unexpected error");
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ─── POST /api/auth/email-hook ────────────────────────────────────────────────

/**
 * Supabase Auth "Send Email" Hook.
 *
 * When registered in the Supabase Dashboard this endpoint receives every
 * outbound auth email from Supabase and replaces it with a branded
 * IndiePact email sent via Resend. The email contains ONLY the 6-digit OTP
 * code — no magic link, no redirect button.
 *
 * Hook payload from Supabase:
 * {
 *   "user": { "id": "...", "email": "user@example.com", ... },
 *   "email_data": {
 *     "token": "123456",          ← the 6-digit OTP code
 *     "token_hash": "...",
 *     "redirect_to": "...",
 *     "email_action_type": "magiclink" | "signup" | "recovery" | ...
 *   }
 * }
 *
 * Returns {} on success. Returning a non-2xx causes Supabase to mark the
 * email as failed (it does NOT fall back to its own mailer once a hook
 * is registered).
 *
 * Security: Supabase signs every request with HMAC-SHA256. Set
 * SUPABASE_WEBHOOK_SECRET to enable signature verification.
 */
router.post("/auth/email-hook", async (req, res) => {
  // Signature verification
  const signature = req.headers["x-supabase-signature"] as string | undefined;
  const rawBody = JSON.stringify(req.body);

  if (!verifySupabaseHmac(rawBody, signature)) {
    req.log.warn({ signature }, "Email hook: invalid HMAC signature — rejecting request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env["SUPABASE_WEBHOOK_SECRET"]) {
    req.log.warn(
      "Email hook: SUPABASE_WEBHOOK_SECRET is not set — signature verification is disabled. " +
      "Set it to the secret shown in Supabase Dashboard → Auth → Hooks.",
    );
  }

  // Parse payload
  const body = req.body as {
    user?: { id?: string; email?: string };
    email_data?: {
      token?: string;
      token_hash?: string;
      redirect_to?: string;
      email_action_type?: string;
    };
  };

  const email = body.user?.email?.toLowerCase().trim();
  const otp = body.email_data?.token;
  const actionType = body.email_data?.email_action_type ?? "unknown";

  if (!email || !otp) {
    req.log.warn({ body: req.body }, "Email hook: missing email or token in payload");
    return res.status(400).json({ error: "Invalid hook payload: missing email or token" });
  }

  if (!isEmailServiceReady()) {
    req.log.error({ email }, "Email hook: RESEND_API_KEY is not set — cannot send email");
    return res.status(503).json({ error: "Email service not configured" });
  }

  try {
    await sendOtpEmail(email, otp);
    req.log.info({ email, actionType }, "Email hook: OTP sent via Resend");
    return res.json({});
  } catch (err) {
    req.log.error({ err, email, actionType }, "Email hook: Resend delivery failed");
    return res.status(500).json({ error: "Email delivery failed" });
  }
});

export default router;
