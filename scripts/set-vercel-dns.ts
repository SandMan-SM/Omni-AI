// Sets Namecheap DNS records on the 3 newly bought Utah news domains
// to point at Vercel — apex A → 76.76.21.21, www CNAME → cname.vercel-dns.com.
// Once these land, Vercel auto-verifies and provisions SSL within ~5 min.
//
// Run: npx tsx scripts/set-vercel-dns.ts

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

const ApiUser = process.env.NAMECHEAP_API_USER!;
const ApiKey = process.env.NAMECHEAP_API_KEY!;
const UserName = process.env.NAMECHEAP_USERNAME!;
const ClientIp = process.env.NAMECHEAP_CLIENT_IP!;

if (!ApiUser || !ApiKey || !UserName || !ClientIp) {
  console.error("Missing Namecheap env vars. Need API_USER + API_KEY + USERNAME + CLIENT_IP.");
  process.exit(1);
}

const DOMAINS = [
  { sld: "utahmainstreet", tld: "com" },
  { sld: "beehivebizpulse", tld: "com" },
  { sld: "thewasatchpost", tld: "com" },
];

// Vercel-recommended DNS for apex + www aliasing.
// (Reference: vercel.link/domain-configuration)
const VERCEL_A_IP = "76.76.21.21";
const VERCEL_CNAME = "cname.vercel-dns.com.";

async function callNamecheap(command: string, extra: Record<string, string>): Promise<string> {
  const params = new URLSearchParams({
    ApiUser,
    ApiKey,
    UserName,
    ClientIp,
    Command: command,
    ...extra,
  });
  const res = await fetch(`https://api.namecheap.com/xml.response?${params.toString()}`);
  return res.text();
}

function quickStatus(xml: string): "OK" | "ERROR" {
  return xml.includes('Status="OK"') ? "OK" : "ERROR";
}

function extractError(xml: string): string {
  const m = xml.match(/<Error[^>]*>([^<]+)<\/Error>/);
  return m ? m[1] : "unknown error (full XML logged above)";
}

async function setHosts(sld: string, tld: string) {
  // Two records: apex A + www CNAME. setHosts REPLACES the entire host
  // set — fine for these freshly bought domains because they have no
  // mail / verification / other records yet. If we later need to keep
  // MX records intact, we'd getHosts → merge → setHosts.
  const xml = await callNamecheap("namecheap.domains.dns.setHosts", {
    SLD: sld,
    TLD: tld,
    HostName1: "@",
    RecordType1: "A",
    Address1: VERCEL_A_IP,
    TTL1: "300",
    HostName2: "www",
    RecordType2: "CNAME",
    Address2: VERCEL_CNAME,
    TTL2: "300",
  });
  const status = quickStatus(xml);
  if (status === "OK") {
    console.log(`[${sld}.${tld}] DNS set: A @ → ${VERCEL_A_IP}, CNAME www → ${VERCEL_CNAME}`);
  } else {
    console.error(`[${sld}.${tld}] FAILED — ${extractError(xml)}`);
    console.error(xml);
  }
}

async function main() {
  for (const d of DOMAINS) {
    await setHosts(d.sld, d.tld);
  }
  console.log("\nDone. Vercel verification + SSL should land in 5–10 min. Check:");
  console.log("  https://vercel.com/sandman-sms-projects/utah-main-street/settings/domains");
  console.log("  https://vercel.com/sandman-sms-projects/beehive-biz-pulse/settings/domains");
  console.log("  https://vercel.com/sandman-sms-projects/the-wasatch-post/settings/domains");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
