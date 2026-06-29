// One-off: create the PayPal subscription plan for the Rene Laveau
// referral offer — $300/month for EXACTLY 10 months ($3,000 total),
// then the subscription completes (total_cycles = 10).
//
// Offer = Tier-3 federation build at the referral rate. Personal AI
// assistants are intentionally EXCLUDED from this plan per request.
//
// Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENVIRONMENT
// from .env.local. NEVER prints the secret/token — only product + plan IDs.
//
// Run:  node scripts/paypal-create-renelaveau-plan.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env.local");

function readEnv(name) {
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "").trim();
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
  console.error("MISSING_CREDS: PAYPAL_CLIENT_ID/SECRET not found in .env.local");
  process.exit(2);
}
console.log(`env=${ENVIRONMENT} · client_id length=${CLIENT_ID.length} (not printing value)`);

async function token() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
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

  const prodRes = await fetch(`${BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Rene Laveau — Federation Build (Referral)",
      description:
        "Tier-3 federation build, referral rate: $60K+ in owned assets in a 4-month window — custom website (SEO/JSON-LD), AI CEO with lead scoring, branded newsletter + automation, federation distribution. Excludes personal AI assistants.",
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

  const planRes = await fetch(`${BASE}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: prod.id,
      name: "Rene Laveau Referral — $300/month x 10",
      description:
        "$300/month for 10 months ($3,000 total). Tier-3 federation build, referral rate. Excludes personal AI assistants.",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 10, // exactly 10 payments, then completes
          pricing_scheme: { fixed_price: { value: "300", currency_code: "USD" } },
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
  console.log("DONE — $300/mo x 10 plan created.");
}

main().catch((e) => {
  console.error("ERROR", e?.message || e);
  process.exit(1);
});
