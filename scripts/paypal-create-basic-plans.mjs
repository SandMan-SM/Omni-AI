// One-off: create the PayPal subscription plans for the "Basic
// Membership" pricing cards — a $1,000/month plan and an $11,000/year
// plan (annual, ~8% off the monthly run-rate). Both open-ended
// (auto-renew) subscriptions.
//
// Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENVIRONMENT
// from .env.local. NEVER prints the secret or the access token — only
// the resulting product_id + plan_ids (safe to share / embed).
//
// Run:  node scripts/paypal-create-basic-plans.mjs
// Re-running creates NEW plans each time — only run once, then keep the
// printed PLAN_IDs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env.local");

function readEnv(name) {
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) {
      return m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return "";
}

const CLIENT_ID = readEnv("PAYPAL_CLIENT_ID");
const CLIENT_SECRET = readEnv("PAYPAL_CLIENT_SECRET");
const ENVIRONMENT = (readEnv("PAYPAL_ENVIRONMENT") || "live").toLowerCase();
const BASE =
  ENVIRONMENT === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "MISSING_CREDS: PAYPAL_CLIENT_ID and/or PAYPAL_CLIENT_SECRET not found in .env.local",
  );
  process.exit(2);
}
console.log(`env=${ENVIRONMENT} · client_id length=${CLIENT_ID.length} (not printing value)`);

async function token() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    console.error(`AUTH_FAILED ${r.status}: ${JSON.stringify(j)}`);
    process.exit(1);
  }
  return j.access_token;
}

async function createPlan(access, productId, { name, description, value, intervalUnit }) {
  const res = await fetch(`${BASE}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: productId,
      name,
      description,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // open-ended (auto-renew)
          pricing_scheme: {
            fixed_price: { value: String(value), currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    }),
  });
  const plan = await res.json();
  if (!res.ok) {
    console.error(`PLAN_FAILED (${name}) ${res.status}: ${JSON.stringify(plan)}`);
    process.exit(1);
  }
  return plan;
}

async function main() {
  const access = await token();
  console.log("AUTH_OK (token received, not printing it)");

  // 1. Catalog product — Basic Membership
  const prodRes = await fetch(`${BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Omni AI — Basic Membership",
      description:
        "Basic Membership: $25,000 agentic website, $100,000 AI CEO with advanced marketing capabilities, fully automated newsletter, and more federation systems unlocked inside.",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  const prod = await prodRes.json();
  if (!prodRes.ok) {
    console.error(`PRODUCT_FAILED ${prodRes.status}: ${JSON.stringify(prod)}`);
    process.exit(1);
  }
  console.log(`PRODUCT_ID=${prod.id}`);

  // 2a. Monthly plan — $1,000/month
  const monthly = await createPlan(access, prod.id, {
    name: "Basic Membership — $1,000/month",
    description: "$1,000/month recurring · Omni AI Basic Membership. Auto-renews monthly.",
    value: 1000,
    intervalUnit: "MONTH",
  });
  console.log(`MONTHLY_PLAN_ID=${monthly.id}`);
  console.log(`MONTHLY_PLAN_STATUS=${monthly.status}`);

  // 2b. Annual plan — $11,000/year (~8% off the $12,000 monthly run-rate)
  const annual = await createPlan(access, prod.id, {
    name: "Basic Membership — $11,000/year",
    description: "$11,000/year recurring · Omni AI Basic Membership (save ~8% vs monthly). Auto-renews yearly.",
    value: 11000,
    intervalUnit: "YEAR",
  });
  console.log(`ANNUAL_PLAN_ID=${annual.id}`);
  console.log(`ANNUAL_PLAN_STATUS=${annual.status}`);

  console.log("DONE — keep the PLAN_IDs above.");
}

main().catch((e) => {
  console.error("ERROR", e?.message || e);
  process.exit(1);
});
