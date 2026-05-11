import { Router } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "../lib/supabase.js";

const router = Router();

const SendOtpSchema = z.object({ email: z.string().email() });

/**
 * POST /api/auth/otp/send
 *
 * Sends a 6-digit verification code to the user's email without any magic
 * link or email-confirmation step.
 *
 * Flow:
 *  1. Admin API — create the user (if new) with email_confirm: true.
 *     This bypasses the Supabase "Follow this link to confirm your user"
 *     signup-confirmation email that fires for unconfirmed new accounts.
 *  2. Anon client — call signInWithOtp with shouldCreateUser: false.
 *     Because the account is already confirmed, Supabase sends the OTP /
 *     magic-link email (not the confirmation email).
 *
 * Future upgrade path (zero code changes here):
 *  - Register a Supabase Auth "Send Email" Hook pointing to /api/auth/email-hook.
 *  - Supabase will call that hook instead of sending its default email.
 *  - The hook can send a fully branded OTP-only email via Resend /
 *    auth@indiepact.pro with just the 6-digit code and no magic link.
 */
router.post("/auth/otp/send", async (req, res) => {
  const parse = SendOtpSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const { email } = parse.data;

  try {
    const admin = requireSupabase();

    // Step 1 — Ensure user exists and email is pre-confirmed so the next step
    // sends an OTP email rather than a signup confirmation email.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (createErr) {
      const msg = createErr.message.toLowerCase();
      // "already registered" / "already exists" is expected for returning users.
      if (!msg.includes("already") && !msg.includes("exists")) {
        req.log.warn({ err: createErr, email }, "Admin createUser non-fatal warning");
      }
    }

    // Step 2 — Send the OTP email via the anon client.
    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(503).json({ error: "Email service is not configured." });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: otpErr } = await anonClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // account is already created above
      },
    });

    if (otpErr) {
      req.log.error({ err: otpErr, email }, "signInWithOtp failed");
      return res.status(500).json({ error: "Could not send the verification code. Please try again." });
    }

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err, email }, "OTP send unexpected error");
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
