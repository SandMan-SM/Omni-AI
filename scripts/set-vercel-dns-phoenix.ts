// Points phoenixexteriors.com (apex + www) at Vercel via Namecheap API.
// Mirrors scripts/set-vercel-dns.ts; kept separate so the Utah-newsroom
// script stays a clean record of what shipped for that batch.
//
// IP-WHITELIST NOTE: Namecheap rejects API calls unless the calling
// machine's outbound IP matches BOTH the dashboard whitelist AND the
// ClientIp param in .env.local (NAMECHEAP_CLIENT_IP). The current
// .env.local lists 172.59.152.19 — Sita's home Mac IP. Run this script
// from THAT machine. Calling it from a remote worktree returns
// 1011150 "Invalid request IP".
//
// Run: npx tsx scripts/set-vercel-dns-phoenix.ts

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

const DOMAINS = [{ sld: "phoenixexteriors", tld: "com" }];

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
  console.log("\nDone. Add phoenixexteriors.com + www.phoenixexteriors.com to the");
  console.log("Vercel project domain list, then verification + SSL lands in ~5 min.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
