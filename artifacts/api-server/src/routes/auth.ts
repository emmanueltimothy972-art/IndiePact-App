import { Router } from "express";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabase } from "../lib/supabase.js";
import type { Logger } from "pino";

const router = Router();

const SendOtpSchema = z.object({ email: z.string().email() });

/**
 * Ensures a user exists in Supabase Auth with their email confirmed.
 *
 * Root cause of "Follow this link to confirm your user" emails:
 *   Supabase sends the signup-confirmation email (not the OTP email) whenever
 *   signInWithOtp is called for a user whose email_confirmed_at is null — even
 *   when OTP mode is enabled. This helper eliminates that by guaranteeing the
 *   account is confirmed before signInWithOtp is ever called.
 *
 * Strategy:
 *   1. Try admin.createUser({ email_confirm: true }) — instant for new users.
 *   2. If the user already exists, page through listUsers to find them and call
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

  // Any "already exists" variant — confirm the existing account.
  const msg = createErr.message.toLowerCase();
  log.info({ email, errMsg: msg }, "createUser failed — finding existing user to confirm");

  const PER_PAGE = 50;
  let page = 1;

  while (true) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (listErr) {
      log.warn({ err: listErr, email }, "listUsers error while looking up user");
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
          log.warn({ err: updateErr, userId: found.id, email }, "updateUserById warning");
        }
      } else {
        log.info({ userId: found.id, email }, "Existing user already confirmed");
      }
      return;
    }

    if (users.length < PER_PAGE) {
      // Last page reached without finding the user.
      log.warn({ email }, "User not found in listUsers — proceeding anyway");
      break;
    }

    page++;
  }
}

/**
 * POST /api/auth/otp/send
 *
 * Backend-driven OTP dispatch that guarantees users NEVER receive the
 * "Follow this link to confirm your user" signup-confirmation email.
 *
 * Flow:
 *   1. ensureUserConfirmed() — creates or confirms the user via Admin API.
 *      No email is sent in this step.
 *   2. anonClient.signInWithOtp({ shouldCreateUser: false }) — because the
 *      account is now confirmed, Supabase sends the OTP email (6-digit code)
 *      rather than the signup-confirmation email.
 *
 * Future upgrade (no code changes needed here):
 *   Register a Supabase Auth "Send Email" Hook pointing to
 *   /api/auth/email-hook. Supabase will call that hook instead of its own
 *   mailer, letting you send a fully-branded OTP-only email via Resend /
 *   auth@indiepact.pro with no link at all.
 */
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

    // Step 1 — guarantee the account exists and email is confirmed.
    await ensureUserConfirmed(admin, email, req.log as Logger);

    // Step 2 — send the OTP email via the anon client.
    // shouldCreateUser: false → if ensureUserConfirmed failed silently, we get
    // a clean error here rather than falling through to a confirmation email.
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: otpErr } = await anonClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (otpErr) {
      req.log.error({ err: otpErr, email }, "signInWithOtp failed");
      return res
        .status(500)
        .json({ error: "Could not send the verification code. Please try again." });
    }

    req.log.info({ email }, "OTP sent successfully");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err, email }, "OTP send unexpected error");
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
