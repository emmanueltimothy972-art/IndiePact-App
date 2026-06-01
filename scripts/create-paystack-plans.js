#!/usr/bin/env node

/**
 * scripts/create-paystack-plans.js
 *
 * Programmatically creates all IndiePact recurring subscription plans through
 * the Paystack API with explicit USD currency.
 *
 * WHY SEQUENTIAL EXECUTION (for...of, not Promise.all):
 *   - Paystack rate-limits rapid bursts from the same API key.
 *   - Sequential requests give each response time to fully propagate on
 *     Paystack's side before the next plan is attempted.
 *   - Duplicate-detection logging is cleaner when results arrive one at a time.
 *   - A single failed plan does NOT cancel the remaining ones, which is the
 *     correct behavior for a setup script that may be re-run mid-flight.
 *
 * USAGE:
 *   node scripts/create-paystack-plans.js
 *
 * REQUIRED ENV:
 *   PAYSTACK_SECRET_KEY   — your Paystack secret key (sk_test_... or sk_live_...)
 *
 * Safe to re-run: duplicate plans are detected, logged as warnings, and skipped.
 */

// ─── 0. Guard: fail fast if the secret key is absent ─────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.trim() === "") {
  console.error(
    "\n✗  PAYSTACK_SECRET_KEY is not set.\n" +
      "   Export it before running this script:\n\n" +
      "     export PAYSTACK_SECRET_KEY=sk_test_...\n\n" +
      "   Never hardcode secrets into source files.\n"
  );
  process.exit(1);
}

// ─── 1. Plan definitions ──────────────────────────────────────────────────────
//
// Amounts are in the SMALLEST currency unit (USD cents).
//   $19.00  → 1900
//   $49.99  → 4999
//   $99.00  → 9900
//   $149.00 → 14900
//   $199.00 → 19900

const PLANS = [
  {
    name: "IndiePact Starter",
    description:
      "Starter subscription for independent professionals reviewing contracts regularly.",
    amount: 1900,
    interval: "monthly",
    currency: "USD",
  },
  {
    name: "IndiePact Pro",
    description:
      "Advanced AI contract intelligence for power users and professionals.",
    amount: 4999,
    interval: "monthly",
    currency: "USD",
  },
  {
    name: "IndiePact Business",
    description:
      "Business-grade contract intelligence with advanced negotiation systems.",
    amount: 9900,
    interval: "monthly",
    currency: "USD",
  },
  {
    name: "IndiePact Agency",
    description:
      "Agency collaboration infrastructure for managing multiple client contracts.",
    amount: 14900,
    interval: "monthly",
    currency: "USD",
  },
  {
    name: "IndiePact Enterprise",
    description:
      "Enterprise-scale legal AI infrastructure with maximum platform capabilities.",
    amount: 19900,
    interval: "monthly",
    currency: "USD",
  },
];

// ─── 2. Helpers ───────────────────────────────────────────────────────────────

/** Format a cent amount to a human-readable USD string. */
function formatAmount(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Attempt to create a single Paystack plan.
 *
 * Returns an object:
 *   { status: "created" | "duplicate" | "error", planCode?, message?, raw? }
 */
async function createPlan(plan) {
  const url = "https://api.paystack.co/plan";
  let response;
  let body;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: plan.name,
        description: plan.description,
        amount: plan.amount,
        interval: plan.interval,
        currency: plan.currency,
      }),
    });
  } catch (networkErr) {
    return {
      status: "error",
      message: `Network failure: ${networkErr.message}`,
    };
  }

  try {
    body = await response.json();
  } catch {
    return {
      status: "error",
      message: `Paystack returned non-JSON response (HTTP ${response.status})`,
    };
  }

  // Paystack 200/201 with status:true → plan created
  if (response.ok && body.status === true && body.data?.plan_code) {
    return { status: "created", planCode: body.data.plan_code, raw: body };
  }

  // Paystack signals a duplicate plan in several ways.
  // Normalise to a consistent "duplicate" result so callers can skip cleanly.
  const msg = (body.message ?? "").toLowerCase();
  const isDuplicate =
    response.status === 409 ||
    msg.includes("already exist") ||
    msg.includes("duplicate") ||
    msg.includes("plan with this name");

  if (isDuplicate) {
    return {
      status: "duplicate",
      message: body.message ?? "Duplicate plan detected",
      raw: body,
    };
  }

  // Everything else is a genuine error.
  return {
    status: "error",
    message: body.message ?? `HTTP ${response.status}`,
    raw: body,
  };
}

/** Print a horizontal rule. */
function rule() {
  console.log("─".repeat(56));
}

// ─── 3. Main execution ────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   IndiePact — Paystack Recurring Plan Setup          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log(`  API key prefix : ${PAYSTACK_SECRET_KEY.slice(0, 10)}…`);
  console.log(`  Plans to create: ${PLANS.length}`);
  console.log(`  Execution mode : sequential (rate-limit safe)\n`);

  rule();

  // Accumulate results for the final summary table.
  const results = [];

  // WHY for...of and NOT Promise.all():
  //   Each iteration awaits the previous response before sending the next
  //   request. This prevents burst rate-limit rejections and ensures that
  //   duplicate detection (based on plan name) is reliable.
  for (const plan of PLANS) {
    console.log(`\n  → Creating: ${plan.name}`);
    console.log(`    Amount  : ${formatAmount(plan.amount)}/month`);
    console.log(`    Currency: ${plan.currency}`);

    const result = await createPlan(plan);

    switch (result.status) {
      case "created":
        console.log(`\n  ✓  Plan Created`);
        console.log(`     Name     : ${plan.name}`);
        console.log(`     Plan Code: ${result.planCode}`);
        console.log(`     Amount   : ${formatAmount(plan.amount)}/month`);
        console.log(`     Currency : ${plan.currency}`);
        results.push({
          name: plan.name,
          planCode: result.planCode,
          amount: formatAmount(plan.amount),
          status: "✓ Created",
        });
        break;

      case "duplicate":
        console.warn(`\n  ⚠  Duplicate plan — already exists on Paystack.`);
        console.warn(`     Name   : ${plan.name}`);
        console.warn(`     Reason : ${result.message}`);
        console.warn(`     Action : Skipping — no changes made.`);
        results.push({
          name: plan.name,
          planCode: "—  (pre-existing)",
          amount: formatAmount(plan.amount),
          status: "⚠ Duplicate",
        });
        break;

      case "error":
        console.error(`\n  ✗  Failed to create plan.`);
        console.error(`     Name   : ${plan.name}`);
        console.error(`     Reason : ${result.message}`);
        if (result.raw) {
          console.error(`     API body: ${JSON.stringify(result.raw, null, 2)}`);
        }
        results.push({
          name: plan.name,
          planCode: "—",
          amount: formatAmount(plan.amount),
          status: "✗ Error",
        });
        break;
    }

    rule();
  }

  // ─── 4. Summary table ──────────────────────────────────────────────────────

  console.log("\n\n  SUMMARY\n");
  console.log(
    `  ${"Plan Name".padEnd(28)} ${"Plan Code".padEnd(22)} ${"Amount".padEnd(12)} Status`
  );
  console.log(
    `  ${"─".repeat(28)} ${"─".repeat(22)} ${"─".repeat(12)} ${"─".repeat(12)}`
  );
  for (const r of results) {
    console.log(
      `  ${r.name.padEnd(28)} ${r.planCode.padEnd(22)} ${r.amount.padEnd(12)} ${r.status}`
    );
  }

  const created = results.filter((r) => r.status.startsWith("✓")).length;
  const dupes   = results.filter((r) => r.status.startsWith("⚠")).length;
  const errors  = results.filter((r) => r.status.startsWith("✗")).length;

  console.log(
    `\n  Done — ${created} created, ${dupes} already existed, ${errors} error(s).\n`
  );

  if (created > 0) {
    console.log(
      "  ► Copy the Plan Codes above into your Supabase config,\n" +
        "    subscription verification flows, and frontend checkout\n" +
        "    initialization payloads before going live.\n"
    );
  }

  if (errors > 0) {
    process.exit(1); // Signal to CI that something needs attention
  }
}

main().catch((err) => {
  console.error("\n✗  Unexpected fatal error:\n", err);
  process.exit(1);
});
