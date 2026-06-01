#!/usr/bin/env node

/**
 * scripts/create-paystack-plans.js
 *
 * Provisions all IndiePact recurring subscription plans on Paystack.
 *
 * CURRENCY NOTE:
 *   Currently using NGN (kobo) as a temporary measure while Paystack
 *   multi-currency USD enablement is pending. Migration to USD requires
 *   only changing PLANS[].currency and PLANS[].amount — no logic changes.
 *
 * IDEMPOTENCY:
 *   Fetches all existing Paystack plans before creating anything.
 *   Plans whose name already exists are skipped and their existing
 *   plan_code is reused in the output map. Safe to run multiple times.
 *
 * WHY SEQUENTIAL (for...of, not Promise.all):
 *   Paystack rate-limits burst requests from the same key. Sequential
 *   iteration gives each response time to propagate and makes per-plan
 *   logging deterministic and readable. A failure on one plan does not
 *   cancel the rest.
 *
 * WEBHOOK COMPATIBILITY:
 *   Plans created here work natively with all Paystack subscription
 *   webhook events: charge.success, invoice.payment_failed,
 *   subscription.create, subscription.disable, subscription.not_renew,
 *   invoice.update — no additional configuration required.
 *
 * USAGE:
 *   node scripts/create-paystack-plans.js
 *
 * OUTPUT:
 *   scripts/paystack-plan-codes.json  — machine-readable plan code map
 *                                       ready for Supabase / billing middleware
 */

// ─── 0. Environment guard ─────────────────────────────────────────────────────

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!SECRET_KEY || SECRET_KEY.trim() === "") {
  console.error(
    "\n✗  PAYSTACK_SECRET_KEY is not set.\n" +
    "   Add it to Replit Secrets, then re-run the script.\n" +
    "   Never hardcode secret keys in source files.\n"
  );
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${SECRET_KEY}`,
  "Content-Type": "application/json",
};

// ─── 1. Plan definitions ──────────────────────────────────────────────────────
//
// Amounts are in kobo (smallest NGN unit): ₦1 = 100 kobo.
//
// USD migration checklist (nothing else changes):
//   1. Set currency: "USD"
//   2. Set amounts to USD cents  ($19 → 1900)
//   3. Obtain Paystack USD multi-currency approval
//
// usdEquivalent is metadata only — never sent to the API.

const PLANS = [
  {
    name: "IndiePact Starter",
    description: "Starter subscription for independent professionals reviewing contracts regularly.",
    currency: "NGN",
    interval: "monthly",
    amount: 3_000_000,        // ₦30,000 ≈ $19/month USD target
    usdEquivalent: "$19.00",
    humanPrice: "₦30,000",
    tier: "starter",
  },
  {
    name: "IndiePact Pro",
    description: "Advanced AI contract intelligence for power users and professionals.",
    currency: "NGN",
    interval: "monthly",
    amount: 8_000_000,        // ₦80,000 ≈ $49.99/month USD target
    usdEquivalent: "$49.99",
    humanPrice: "₦80,000",
    tier: "pro",
  },
  {
    name: "IndiePact Business",
    description: "Business-grade contract intelligence with advanced negotiation systems.",
    currency: "NGN",
    interval: "monthly",
    amount: 16_000_000,       // ₦160,000 ≈ $99/month USD target
    usdEquivalent: "$99.00",
    humanPrice: "₦160,000",
    tier: "business",
  },
  {
    name: "IndiePact Agency",
    description: "Agency collaboration infrastructure for managing multiple client contracts.",
    currency: "NGN",
    interval: "monthly",
    amount: 24_000_000,       // ₦240,000 ≈ $149/month USD target
    usdEquivalent: "$149.00",
    humanPrice: "₦240,000",
    tier: "agency",
  },
  {
    name: "IndiePact Enterprise",
    description: "Enterprise-scale legal AI infrastructure with maximum platform capabilities.",
    currency: "NGN",
    interval: "monthly",
    amount: 32_000_000,       // ₦320,000 ≈ $199/month USD target
    usdEquivalent: "$199.00",
    humanPrice: "₦320,000",
    tier: "enterprise",
  },
];

// ─── 2. API helpers ───────────────────────────────────────────────────────────

/**
 * Fetch all existing Paystack plans (paginated, up to 200).
 * Returns an array of { name, plan_code } objects.
 */
async function fetchExistingPlans() {
  const url = "https://api.paystack.co/plan?perPage=200&page=1";
  let response, body;

  try {
    response = await fetch(url, { headers: HEADERS });
    body = await response.json();
  } catch (err) {
    throw new Error(`Failed to fetch existing plans: ${err.message}`);
  }

  if (!response.ok || body.status !== true) {
    throw new Error(
      `Paystack plan list failed: ${body.message ?? `HTTP ${response.status}`}`
    );
  }

  return (body.data ?? []).map((p) => ({
    name: p.name,
    plan_code: p.plan_code,
  }));
}

/**
 * Create a single Paystack plan.
 * Returns { status: "created"|"error", planCode?, message?, raw? }
 */
async function createPlan(plan) {
  let response, body;

  try {
    response = await fetch("https://api.paystack.co/plan", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        amount: plan.amount,
        currency: plan.currency,
      }),
    });
    body = await response.json();
  } catch (networkErr) {
    return { status: "error", message: `Network failure: ${networkErr.message}` };
  }

  if (response.ok && body.status === true && body.data?.plan_code) {
    return { status: "created", planCode: body.data.plan_code, raw: body };
  }

  return {
    status: "error",
    message: body.message ?? `HTTP ${response.status}`,
    raw: body,
  };
}

// ─── 3. Terminal formatting ───────────────────────────────────────────────────

const COL = { plan: 28, cur: 9, amount: 14, code: 20, status: 9 };

function tableHeader() {
  const top =
    "┌" + "─".repeat(COL.plan + 2) +
    "┬" + "─".repeat(COL.cur + 2) +
    "┬" + "─".repeat(COL.amount + 2) +
    "┬" + "─".repeat(COL.code + 2) +
    "┬" + "─".repeat(COL.status + 2) + "┐";

  const hdr =
    "│ " + "Plan".padEnd(COL.plan) +
    " │ " + "Currency".padEnd(COL.cur) +
    " │ " + "Amount".padEnd(COL.amount) +
    " │ " + "Plan Code".padEnd(COL.code) +
    " │ " + "Status".padEnd(COL.status) + " │";

  const div =
    "├" + "─".repeat(COL.plan + 2) +
    "┼" + "─".repeat(COL.cur + 2) +
    "┼" + "─".repeat(COL.amount + 2) +
    "┼" + "─".repeat(COL.code + 2) +
    "┼" + "─".repeat(COL.status + 2) + "┤";

  console.log(top);
  console.log(hdr);
  console.log(div);
}

function tableRow(r) {
  console.log(
    "│ " + r.name.padEnd(COL.plan) +
    " │ " + r.currency.padEnd(COL.cur) +
    " │ " + r.amount.padEnd(COL.amount) +
    " │ " + r.code.padEnd(COL.code) +
    " │ " + r.status.padEnd(COL.status) + " │"
  );
}

function tableFooter() {
  console.log(
    "└" + "─".repeat(COL.plan + 2) +
    "┴" + "─".repeat(COL.cur + 2) +
    "┴" + "─".repeat(COL.amount + 2) +
    "┴" + "─".repeat(COL.code + 2) +
    "┴" + "─".repeat(COL.status + 2) + "┘"
  );
}

// ─── 4. Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   IndiePact — Paystack Recurring Plan Provisioning   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`  Key prefix : ${SECRET_KEY.slice(0, 10)}…`);
  console.log(`  Currency   : NGN (temporary; USD pending multi-currency approval)`);
  console.log(`  Plans      : ${PLANS.length}\n`);

  // ── Step 1: fetch existing plans for idempotency check ──────────────────────
  console.log("  ► Fetching existing Paystack plans for idempotency check…");
  let existing = [];
  try {
    existing = await fetchExistingPlans();
    console.log(`    Found ${existing.length} existing plan(s) on this account.\n`);
  } catch (err) {
    console.error(`\n  ✗  Could not fetch existing plans: ${err.message}`);
    console.error("     Aborting to prevent accidental duplicates.\n");
    process.exit(1);
  }

  const existingByName = new Map(existing.map((p) => [p.name.toLowerCase(), p.plan_code]));

  // ── Step 2: create or skip each plan ────────────────────────────────────────
  const results   = [];
  const planCodes = {};  // tier → plan_code  (for Supabase config map)

  for (const plan of PLANS) {
    const existingCode = existingByName.get(plan.name.toLowerCase());

    if (existingCode) {
      console.log(`  ⚠  EXISTS   ${plan.name}`);
      console.log(`     Code   : ${existingCode}`);
      console.log(`     Action : Skipping — reusing existing plan.\n`);
      results.push({ name: plan.name, currency: plan.currency, amount: plan.humanPrice, code: existingCode, status: "EXISTS" });
      planCodes[plan.tier] = existingCode;
      continue;
    }

    console.log(`  →  Creating ${plan.name} (${plan.humanPrice}/month ≈ ${plan.usdEquivalent} USD)…`);
    const result = await createPlan(plan);

    if (result.status === "created") {
      console.log(`  ✓  CREATED  ${plan.name}`);
      console.log(`     Code   : ${result.planCode}\n`);
      results.push({ name: plan.name, currency: plan.currency, amount: plan.humanPrice, code: result.planCode, status: "CREATED" });
      planCodes[plan.tier] = result.planCode;
    } else {
      console.error(`  ✗  FAILED   ${plan.name}`);
      console.error(`     Reason : ${result.message}`);
      if (result.raw) console.error(`     API    : ${JSON.stringify(result.raw)}\n`);
      results.push({ name: plan.name, currency: plan.currency, amount: plan.humanPrice, code: "—", status: "FAILED" });
    }
  }

  // ── Step 3: summary table ────────────────────────────────────────────────────
  console.log("\n  SUMMARY\n");
  tableHeader();
  for (const r of results) tableRow(r);
  tableFooter();

  const created = results.filter((r) => r.status === "CREATED").length;
  const existed = results.filter((r) => r.status === "EXISTS").length;
  const failed  = results.filter((r) => r.status === "FAILED").length;
  console.log(`\n  ${created} created  ·  ${existed} already existed  ·  ${failed} failed\n`);

  // ── Step 4: write plan code config map ──────────────────────────────────────
  const { writeFileSync } = await import("fs");
  const { resolve } = await import("path");

  const outputPath = resolve("scripts/paystack-plan-codes.json");
  const output = {
    _note: "Auto-generated by scripts/create-paystack-plans.js — do not edit manually.",
    _currency: "NGN",
    _migrationNote: "To migrate to USD: re-run script after Paystack enables multi-currency on this account.",
    generatedAt: new Date().toISOString(),
    plans: planCodes,
  };

  try {
    writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
    console.log(`  ► Plan code map saved to: scripts/paystack-plan-codes.json`);
    console.log(`    Use this in: checkout routes, webhook handlers, Supabase sync, billing middleware.\n`);
  } catch (err) {
    console.error(`  ✗  Could not write plan code map: ${err.message}\n`);
  }

  if (failed > 0) {
    console.error("  Some plans failed to create. Review errors above.\n");
    process.exit(1);
  }

  console.log("  ✓  Provisioning complete. Infrastructure is ready for:\n");
  console.log("     • Recurring monthly auto-renewals");
  console.log("     • Webhook lifecycle automation (charge.success, subscription.create, etc.)");
  console.log("     • Supabase subscription status persistence");
  console.log("     • Checkout initialization (pass plan_code to Paystack Initialize Transaction)");
  console.log("     • Future upgrade / downgrade / cancellation flows");
  console.log("     • USD migration (config-only change when multi-currency is approved)\n");
}

main().catch((err) => {
  console.error("\n✗  Fatal error:\n", err);
  process.exit(1);
});
