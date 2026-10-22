// Audit the send-domain allowlists against the LIVE Resend account, and
// surface every active campaign whose sender cannot send.
//
// Why this exists: the two allowlists in this repo (VERIFIED_DOMAINS in
// lib/business-marketing.ts, VERIFIED_SENDING_DOMAINS in lib/sender-registry.ts)
// are hand-maintained snapshots of the Resend account. A snapshot rots
// silently — a domain can be removed, or verification revoked, and the
// allowlist keeps naming it. For campaigns that means a clean rejection at
// enqueue turns into a 403 at send time, hours later, for a batch of real
// recipients. This script is the check that catches it first.
//
// Read-only. It never writes to Resend or to the database.

import * as fs from "fs";
import * as path from "path";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!RESEND_API_KEY) { console.error("RESEND_API_KEY not set"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Supabase env not set"); process.exit(1); }

/** Reads a string-array constant out of a repo source file. */
function readArrayConst(file: string, name: string): string[] {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return [];
  const src = fs.readFileSync(full, "utf8");
  const start = src.indexOf(`export const ${name}`);
  if (start === -1) return [];
  const open = src.indexOf("[", start);
  const close = src.indexOf("]", open);
  if (open === -1 || close === -1) return [];
  return [...src.slice(open, close).matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1].toLowerCase());
}

async function main() {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) {
    console.error(`Resend domains fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const payload = (await res.json()) as { data?: Array<{ name: string; status: string }> };
  const domains = payload.data ?? [];
  const verified = domains.filter((d) => d.status === "verified").map((d) => d.name.toLowerCase());
  const notVerified = domains.filter((d) => d.status !== "verified").map((d) => `${d.name} (${d.status})`);

  console.log("=== live Resend account ===");
  console.log(`verified (${verified.length}): ${verified.join(", ") || "none"}`);
  if (notVerified.length) console.log(`not verified: ${notVerified.join(", ")}`);

  let drift = 0;
  for (const [file, name] of [
    ["lib/business-marketing.ts", "VERIFIED_DOMAINS"],
    ["lib/sender-registry.ts", "VERIFIED_SENDING_DOMAINS"],
  ] as const) {
    const listed = readArrayConst(file, name);
    const stale = listed.filter((d) => !verified.includes(d));
    const missing = verified.filter((d) => !listed.includes(d));
    console.log(`\n=== ${file} · ${name} ===`);
    console.log(`listed: ${listed.length}`);
    if (stale.length) { drift += stale.length; console.log(`STALE (not verified in account): ${stale.join(", ")}`); }
    if (missing.length) { drift += missing.length; console.log(`MISSING (verified but unlisted): ${missing.join(", ")}`); }
    if (!stale.length && !missing.length) console.log("in sync with the live account");
  }

  // Active campaigns whose sender domain cannot send. These are queued work
  // that will 403 at send time — the exact defect the owner has to re-point.
  const campRes = await fetch(
    `${SUPABASE_URL}/rest/v1/marketing_campaigns?select=id,business_slug,sender_email,sender_display,status&status=eq.active`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  );
  if (!campRes.ok) {
    console.error(`marketing_campaigns fetch failed: ${campRes.status} ${await campRes.text()}`);
    process.exit(1);
  }
  const campaigns = (await campRes.json()) as Array<{
    id: string; business_slug: string; sender_email: string; sender_display: string; status: string;
  }>;

  console.log(`\n=== active campaigns (${campaigns.length}) ===`);
  const unsendable = campaigns.filter((c) => {
    const domain = String(c.sender_email ?? "").split("@")[1]?.toLowerCase() ?? "";
    return !domain || !verified.includes(domain);
  });
  if (!unsendable.length) {
    console.log("every active campaign sends from a verified domain");
  } else {
    for (const c of unsendable) {
      const domain = String(c.sender_email ?? "").split("@")[1] || "(no domain)";
      console.log(`UNSENDABLE ${c.id} ${c.business_slug} ${c.sender_display} <${c.sender_email}> — ${domain} is not a verified domain`);
    }
  }

  console.log(`\nSUMMARY allowlist_drift=${drift} unsendable_active_campaigns=${unsendable.length}`);
  console.log(drift === 0 && unsendable.length === 0 ? "SEND_DOMAIN_AUDIT_OK TRUE" : "SEND_DOMAIN_AUDIT_OK FALSE");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
