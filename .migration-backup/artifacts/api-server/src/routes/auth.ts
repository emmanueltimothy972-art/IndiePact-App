/**
 * Auth routes — IndiePact API
 *
 * POST /api/auth/otp/send
 *   Sends a 6-digit verification code to the user's email.
 *   Two paths depending on whether RESEND_API_KEY is configured:
 *
 *   Path A — RESEND_API_KEY is set (recommended, production-ready):
 *     1. Ensure the Supabase Auth account exists and is email-confirmed.
 *        (admin.createUser with email_confirm:true for new users, no email sent)
 *     2. Call admin.generateLink() to obtain the OTP token WITHOUT Supabase
 *        sending any email of its own.
 *     3. Send a branded IndiePact email via Resend containing ONLY the
 *        6-digit code. No magic link, no "Follow this link" button.
 *
 *   Path B — no RESEND_API_KEY (fallback):
 *     1. Call signInWithOtp() with shouldCreateUser:true so both new and
 *        returning users are handled.
 *     2. Supabase sends its own email. Update the "Magic Link" template in
 *        Supabase Dashboard → Auth → Email Templates to display {{ .Token }}
 *        if you want a plain 6-digit-only email without configuring Resend.
 *
 * POST /api/auth/email-hook
 *   Supabase Auth "Send Email" Hook endpoint.
 *   When registered in Supabase Dashboard (Auth → Hooks → Send Email),
 *   Supabase POSTs here for every outbound auth email instead of sending
 *   its own. The hook delivers a branded Resend email with only the OTP code.
 *
 *   Registration steps (after RESEND_API_KEY is set):
 *     1. Supabase Dashboard → Authentication → Hooks → Add Hook
 *     2. Hook type: "Send Email"
 *     3. URL: https://<your-api-domain>/api/auth/email-hook
 *     4. Copy the HMAC secret → set as SUPABASE_WEBHOOK_SECRET env var
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
//
// Path A needs this because generateLink() will not create a new user — it
// only generates a token for an existing confirmed account. We create the
// account first (with email_confirm:true) so new sign-ups work seamlessly
// without Supabase ever sending its own "Confirm signup" email.
//
// For Path B, signInWithOtp({ shouldCreateUser:true }) handles creation
// natively so we skip this step.

async function ensureUserConfirmed(
  admin: SupabaseClient,
  email: string,
  log: Logger,
): Promise<void> {
  // Try creating a new pre-confirmed user first (instant, no email sent).
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!createErr) {
    log.info({ email }, "New user created with email pre-confirmed");
    return;
  }

  // User already exists — confirm them if they are still unconfirmed.
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

// ─── GET /api/auth/callback ───────────────────────────────────────────────────
//
// Google OAuth lands here after the user approves the consent screen.
// Supabase appends ?code=<pkce_code> to this URL.
//
// We can't exchange the PKCE code on the server — the verifier lives in the
// user's browser (written by signInWithOAuth before the redirect). So we
// forward the code back to the frontend's /auth/callback page where the
// Supabase JS client (detectSessionInUrl:true + flowType:"pkce") completes
// the exchange automatically and fires onAuthStateChange(SIGNED_IN).

router.get("/auth/callback", (req, res) => {
  const code = req.query["code"] as string | undefined;
  // state is part of the PKCE flow — the Supabase client wrote it to
  // sessionStorage before the redirect and validates it on return to
  // prevent CSRF. It must be forwarded alongside code.
  const state = req.query["state"] as string | undefined;
  const error = req.query["error"] as string | undefined;
  const errorDescription = req.query["error_description"] as string | undefined;

  // Derive the origin from the incoming request so this works identically
  // on Replit preview, staging, and the production custom domain.
  // The destination path is hardcoded (/auth/callback) to eliminate any
  // open-redirect surface — no user-supplied path is ever reflected.
  const origin = `${req.protocol}://${req.get("host")}`;
  const frontendCallback = `${origin}/auth/callback`;

  if (error) {
    req.log.warn({ error, errorDescription }, "OAuth callback: provider returned error");
    const params = new URLSearchParams({ error });
    if (errorDescription) params.set("error_description", errorDescription);
    return res.redirect(302, `${frontendCallback}?${params.toString()}`);
  }

  if (!code) {
    req.log.warn("OAuth callback: no code in query params");
    return res.redirect(302, `${frontendCallback}?error=missing_code`);
  }

  // Forward PKCE code + state to the frontend's /auth/callback page.
  // The Supabase JS client (detectSessionInUrl:true + flowType:"pkce")
  // completes the exchange automatically using the stored code_verifier
  // and validates state, then fires onAuthStateChange(SIGNED_IN).
  req.log.info("OAuth callback: forwarding PKCE code and state to frontend");
  const params = new URLSearchParams({ code });
  if (state) params.set("state", state);
  return res.redirect(302, `${frontendCallback}?${params.toString()}`);
});

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
    if (isEmailServiceReady()) {
      // ── Path A: Resend is configured ─────────────────────────────────────
      // 1. Guarantee a confirmed account exists (creates new users silently).
      // 2. generateLink() extracts the 6-digit OTP token WITHOUT triggering
      //    any Supabase-sent email.
      // 3. We send our own branded email containing ONLY the 6-digit code.
      const admin = requireSupabase();
      await ensureUserConfirmed(admin, email, req.log as Logger);

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
      // ── Path B: Supabase email fallback ───────────────────────────────────
      // signInWithOtp handles both new signups (shouldCreateUser:true) and
      // returning users in one call. Supabase sends its configured email
      // template — update the Magic Link template to show {{ .Token }} for
      // a clean 6-digit-only code email, or configure Resend (Path A) for
      // fully branded delivery.
      req.log.info({ email }, "RESEND_API_KEY not set — using Supabase email fallback (Path B)");

      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error: otpErr } = await anonClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      if (otpErr) {
        req.log.error({ err: otpErr, email }, "signInWithOtp failed");
        return res.status(500).json({ error: "Could not send the verification code. Please try again." });
      }

      req.log.info({ email }, "OTP dispatched via Supabase (Path B)");
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
 * IndiePact email sent via Resend containing ONLY the 6-digit OTP code.
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
 * Returns {} on success. A non-2xx response causes Supabase to mark the
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
