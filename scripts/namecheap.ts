// Namecheap CLI for the federation. One tool, three commands:
//
//   npx tsx scripts/namecheap.ts list
//   npx tsx scripts/namecheap.ts hosts <domain.tld>
//   npx tsx scripts/namecheap.ts vercel <domain.tld>
//
// Reads NAMECHEAP_{API_USER,API_KEY,USERNAME,CLIENT_IP} from .env.local.
//
// IMPORTANT — IP whitelist: Namecheap rejects calls unless the calling
// machine's outbound IP is in the dashboard whitelist AND matches
// NAMECHEAP_CLIENT_IP. Run from the Mac whose IP is whitelisted; from
// other hosts you'll see 1011150 "Invalid request IP".
//
// `vercel <domain>` points apex A → 76.76.21.21 + www CNAME →
// cname.vercel-dns.com. setHosts REPLACES the entire host set, so for
// domains that already have MX / verification records we'd need a
// merging variant — flagged in code below.

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

const ApiUser = process.env.NAMECHEAP_API_USER ?? "";
const ApiKey = process.env.NAMECHEAP_API_KEY ?? "";
const UserName = process.env.NAMECHEAP_USERNAME ?? "";
const ClientIp = process.env.NAMECHEAP_CLIENT_IP ?? "";

if (!ApiUser || !ApiKey || !UserName || !ClientIp) {
  console.error("Missing Namecheap env vars in .env.local — need API_USER, API_KEY, USERNAME, CLIENT_IP.");
  process.exit(1);
}

const VERCEL_A_IP = "76.76.21.21";
const VERCEL_CNAME = "cname.vercel-dns.com.";

async function call(command: string, extra: Record<string, string> = {}): Promise<string> {
  const params = new URLSearchParams({ ApiUser, ApiKey, UserName, ClientIp, Command: command, ...extra });
  const res = await fetch(`https://api.namecheap.com/xml.response?${params.toString()}`);
  return res.text();
}

function ok(xml: string): boolean {
  return xml.includes('Status="OK"');
}

function err(xml: string): string {
  const m = xml.match(/<Error[^>]*>([^<]+)<\/Error>/);
  return m ? m[1] : "unknown error";
}

function splitDomain(d: string): { sld: string; tld: string } {
  const i = d.indexOf(".");
  if (i < 0) throw new Error(`expected sld.tld, got "${d}"`);
  return { sld: d.slice(0, i), tld: d.slice(i + 1) };
}

async function cmdList() {
  const xml = await call("namecheap.domains.getList", { PageSize: "100" });
  if (!ok(xml)) {
    console.error("getList failed:", err(xml));
    console.error(xml);
    process.exit(1);
  }
  // Namecheap returns PAIRED <Domain ...>...</Domain>, not self-closing tags.
  // The old pattern required a trailing "/>" and so matched nothing, printing
  // "Owned domains: 0" while the account held 57. Match the open tag only.
  const rows = [...xml.matchAll(/<Domain\s+([^>]+?)\/?>/g)];
  console.log(`Owned domains: ${rows.length}`);
  for (const r of rows) {
    const attrs = r[1];
    const name = attrs.match(/Name="([^"]+)"/)?.[1] ?? "?";
    const expires = attrs.match(/Expires="([^"]+)"/)?.[1] ?? "?";
    const auto = attrs.match(/AutoRenew="([^"]+)"/)?.[1] ?? "?";
    console.log(`  ${name.padEnd(32)} expires ${expires}  autoRenew=${auto}`);
  }
}

async function cmdHosts(domain: string) {
  const { sld, tld } = splitDomain(domain);
  const xml = await call("namecheap.domains.dns.getHosts", { SLD: sld, TLD: tld });
  if (!ok(xml)) {
    console.error(`getHosts ${domain} failed:`, err(xml));
    console.error(xml);
    process.exit(1);
  }
  // Same fix as cmdList — tolerate both self-closing and paired <host> tags.
  const rows = [...xml.matchAll(/<host\s+([^>]+?)\/?>/gi)];
  console.log(`${domain} — ${rows.length} record(s):`);
  for (const r of rows) {
    const a = r[1];
    const name = a.match(/Name="([^"]*)"/)?.[1] ?? "?";
    const type = a.match(/Type="([^"]*)"/)?.[1] ?? "?";
    const addr = a.match(/Address="([^"]*)"/)?.[1] ?? "?";
    const ttl = a.match(/TTL="([^"]*)"/)?.[1] ?? "?";
    console.log(`  ${type.padEnd(6)} ${name.padEnd(20)} → ${addr.padEnd(40)} TTL=${ttl}`);
  }
}

async function cmdVercel(domain: string) {
  const { sld, tld } = splitDomain(domain);
  // setHosts REPLACES the entire host set. For freshly bought domains
  // with no MX or verification records this is fine. For domains that
  // already have email/verification records, switch to the merging
  // variant (getHosts → mutate → setHosts with all records).
  const xml = await call("namecheap.domains.dns.setHosts", {
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
  if (ok(xml)) {
    console.log(`${domain} → Vercel (A @ ${VERCEL_A_IP}, CNAME www ${VERCEL_CNAME}). SSL in ~5 min.`);
  } else {
    console.error(`${domain} setHosts failed:`, err(xml));
    console.error(xml);
    process.exit(1);
  }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case "list":
      await cmdList();
      return;
    case "hosts":
      if (!arg) throw new Error("usage: hosts <domain.tld>");
      await cmdHosts(arg);
      return;
    case "vercel":
      if (!arg) throw new Error("usage: vercel <domain.tld>");
      await cmdVercel(arg);
      return;
    default:
      console.error("commands: list | hosts <domain> | vercel <domain>");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
