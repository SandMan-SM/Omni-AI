// One-off: create the PayPal subscription plans for the recurring
// (monthly) services on the /solutions à la carte page. One catalog
// product ("Omni AI — Managed Services") with one ACTIVE plan per
// service. One-time builds (websites, AI CEO, CRM) need NO plan — the
// PayPalOrderButton creates the order client-side at the listed amount.
//
// Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENVIRONMENT
// from .env.local. NEVER prints the secret or the access token — only
// the resulting product_id + plan_ids (safe to bake into lib/solutions.ts).
//
// Run:  node scripts/paypal-create-solutions-plans.mjs
// Re-running creates NEW plans each time — run once, then paste the IDs.

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

// key → { name, value (USD/month) }. Meta Ads is intentionally absent —
// it reuses the existing plan P-0CW08001LU923782MNIUHR6I.
const MONTHLY = [
  { key: "newsletter", name: "Hyper-Advanced Agentic Newsletter", value: 1500 },
  { key: "seo-geo", name: "SEO & GEO Optimization", value: 2500 },
  { key: "email-sms", name: "Email & SMS Marketing", value: 1500 },
  { key: "social", name: "Social Media Automation", value: 1500 },
  { key: "cybersecurity", name: "Cybersecurity Services", value: 2000 },
  { key: "lead-gen", name: "Lead Generation / Autonomous Outbound", value: 2500 },
  { key: "chatbot-voice", name: "AI Chatbot + Voice Agent", value: 1000 },
  { key: "analytics", name: "Analytics & Telemetry Dashboard", value: 750 },
  { key: "hosting", name: "Hosting + Maintenance Retainer", value: 1000 },
];

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

async function createPlan(access, productId, { key, name, value }) {
  const res = await fetch(`${BASE}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: productId,
      name: `${name} — $${value}/month`,
      description: `$${value}/month recurring · Omni AI ${name}. Auto-renews monthly.`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: String(value), currency_code: "USD" } },
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
    console.error(`PLAN_FAILED (${key}) ${res.status}: ${JSON.stringify(plan)}`);
    process.exit(1);
  }
  return plan;
}

async function main() {
  const access = await token();
  console.log("AUTH_OK (token received, not printing it)");

  const prodRes = await fetch(`${BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Omni AI — Managed Services",
      description:
        "Omni AI à la carte managed services: agentic newsletters, SEO & GEO, email & SMS, social automation, cybersecurity, lead generation, AI chatbot + voice, analytics, hosting.",
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
  console.log("--- plan ids (paste into lib/solutions.ts) ---");

  for (const svc of MONTHLY) {
    const plan = await createPlan(access, prod.id, svc);
    console.log(`${svc.key}=${plan.id} (${plan.status})`);
  }
  console.log("DONE");
}

main().catch((e) => {
  console.error("ERROR", e?.message || e);
  process.exit(1);
});
