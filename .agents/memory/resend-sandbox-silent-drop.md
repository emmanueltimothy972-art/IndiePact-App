---
name: Resend sandbox silent drop
description: Resend's onboarding@resend.dev sandbox sender silently accepts API calls (HTTP 200) but only delivers to the Resend account owner's email. isEmailServiceReady() must require both RESEND_API_KEY and AUTH_FROM_EMAIL.
---

## The Rule
`isEmailServiceReady()` must return `true` only when BOTH `RESEND_API_KEY` AND `AUTH_FROM_EMAIL` are set.

## Why
Resend's sandbox sender (`onboarding@resend.dev`) is the default when `AUTH_FROM_EMAIL` is not set. When you POST to `https://api.resend.com/emails` using this sender:
- Resend returns **HTTP 200 with a message ID** (the API call succeeds)
- But the email is **only delivered to the Resend account owner's inbox**
- All other recipients receive **nothing, silently**

This caused `/api/auth/otp/send` to return `{ success: true }` while users never received their OTP code. The code logged "OTP sent via Resend (Path A)" — which was technically true from the API perspective — but no email arrived.

The production `debug/env` endpoint revealed: `{ "resendKey": true, "authFromEmail": false }`.

## How to Apply
- In `email.ts`: `isEmailServiceReady()` checks `!!RESEND_API_KEY && !!AUTH_FROM_EMAIL`
- Without `AUTH_FROM_EMAIL`, Path B (Supabase built-in mailer) is used instead — no silent failure
- To activate Resend (Path A): add `AUTH_FROM_EMAIL=IndiePact <auth@indiepact.pro>` in Vercel env vars, and verify the domain `indiepact.pro` in the Resend dashboard

## Vercel env var to add
```
AUTH_FROM_EMAIL=IndiePact <auth@indiepact.pro>
```
Domain must be verified in Resend → Domains before this works.
