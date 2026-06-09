// One-off: create the PayPal subscription plan for the Meta Growth
// Program ($1,500/month, open-ended) so /meta/proposal can offer a
// PayPal subscription alongside the Stripe link.
//
// Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENVIRONMENT
// from .env.local. NEVER prints the secret or the access token — only
// the resulting product_id + plan_id (safe to commit into the page).
//
// Run:  node scripts/paypal-create-meta-plan.mjs
// Idempotent-ish: re-running creates a NEW plan; only run once, then
// paste the printed plan_id into the page.

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

async function main() {
  const access = await token();
  console.log("AUTH_OK (token received, not printing it)");

  // 1. Catalog product
  const prodRes = await fetch(`${BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Meta Growth Program — 90-Day Paid-Social Creative",
      description:
        "90-day Meta creative engine for behavioral-health & recovery centers (Utah Trauma & Addiction Centers): 30 short-form vertical ads, full Meta + pixel + CAPI, audience research + funnel, weekly creative testing.",
      type: "SERVICE",
      category: "ADVERTISING",
    }),
  });
  const prod = await prodRes.json();
  if (!prodRes.ok) {
    console.error(`PRODUCT_FAILED ${prodRes.status}: ${JSON.stringify(prod)}`);
    process.exit(1);
  }
  console.log(`PRODUCT_ID=${prod.id}`);

  // 2. Billing plan — $1,500/month, open-ended (total_cycles 0)
  const planRes = await fetch(`${BASE}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: prod.id,
      name: "Meta Growth Program — $1,500/month",
      description:
        "$1,500/month recurring · 90-day Meta paid-social creative program. Cancel anytime.",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: "1500", currency_code: "USD" },
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
  const plan = await planRes.json();
  if (!planRes.ok) {
    console.error(`PLAN_FAILED ${planRes.status}: ${JSON.stringify(plan)}`);
    process.exit(1);
  }
  console.log(`PLAN_ID=${plan.id}`);
  console.log(`PLAN_STATUS=${plan.status}`);
  console.log("DONE — paste PLAN_ID into the /meta/proposal PayPal button.");
}

main().catch((e) => {
  console.error("ERROR", e?.message || e);
  process.exit(1);
});
