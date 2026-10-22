// One-off: the consolidated owner-decision email for the CPS identity sweep.
// Sent from a VERIFIED Resend domain — omnileadsagi.com is not verified in the
// account, so sending from it 403s.

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
if (!RESEND_API_KEY) { console.error("RESEND_API_KEY not set"); process.exit(1); }

const FROM = "Omni AI <bookings@omnios.news>";
const TO = "sitanim8@gmail.com";

const subject = "Four decisions waiting on you · CPS rebrand shipped";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Owner Decisions</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">The CPS rebrand is live. Four calls are yours.</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    CPS now runs as <strong style="color:#fafafa;">Clinical and Professional Solutions</strong> (cpsutah.org) everywhere on omnileadsagi.com — code, page copy, the partner page, the case study, the sponsor block, the email templates, and the newsletter brief. The live site has zero references to the old practice name left. Four items need you personally; everything else is done.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">1 · Verify cpsutah.org in Resend</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    cpsutah.org is not in the Resend account&rsquo;s verified domains, so all CPS mail currently sends from our house sender (omnios.news). Verify cpsutah.org, then reply here and I will re-point the sender so CPS mail comes from its own domain.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">2 · Two campaigns are queued with senders that cannot send</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Two <strong style="color:#fafafa;">active</strong> campaigns point at domains that are not in the Resend account, so both will fail at send time rather than at queue time: rene@renelaveau.com and alfred@omnileadsagi.com. Tell me which sender each should use and I will fix both.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">3 · Homepage still titles as &ldquo;Interlinked&rdquo;</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Every other page identifies as Omni AI; the homepage alone still reads Interlinked. I asked this before and did not get an answer, so I left it alone rather than renaming your homepage on my own. Keep Interlinked, or move it to Omni AI?
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">4 · Should /cps/marketing be gated?</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The CPS marketing page is publicly reachable with no login, and it shows CPS lead counts, spend, and asset valuation to anyone with the link. It reads like an intentionally shareable explainer, so I did not lock it down. Gate it behind auth, or leave it public?
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Bonus · Four empty legacy tables</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Four tables still carry the old practice name (psychcustody_contacts, psychcustody_campaigns, psychcustody_campaign_sends, psychcustody_contact_events). They hold zero rows and no code reads them, so renaming is cosmetic — but renaming requires a database migration, and I do not run migrations on my own. Say the word and I will run it in a migration session.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Where to look</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li>Partner page: <a href="https://omnileadsagi.com/partners/cps" style="color:#f59e0b;">omnileadsagi.com/partners/cps</a></li>
    <li>Case study: <a href="https://omnileadsagi.com/federation/case-studies/cps" style="color:#f59e0b;">omnileadsagi.com/federation/case-studies/cps</a></li>
    <li>Marketing explainer: <a href="https://omnileadsagi.com/cps/marketing" style="color:#f59e0b;">omnileadsagi.com/cps/marketing</a></li>
    <li>Portfolio system page: <a href="https://omnileadsagi.com/system" style="color:#f59e0b;">omnileadsagi.com/system</a></li>
    <li>Operator dashboard: <a href="https://mythosais.com/dashboard" style="color:#f59e0b;">mythosais.com/dashboard</a></li>
  </ul>

  <p style="color:#71717a;font-size:12px;line-height:1.7;margin:28px 0 0 0;border-top:1px solid #27272a;padding-top:16px;">
    Reply to this email with your four answers and I will handle the rest.
  </p>
</div>
</body></html>`;

const text = `The CPS rebrand is live. Four calls are yours.

CPS now runs as Clinical and Professional Solutions (cpsutah.org) everywhere on omnileadsagi.com — code, page copy, the partner page, the case study, the sponsor block, the email templates, and the newsletter brief. The live site has zero references to the old practice name left.

1. Verify cpsutah.org in Resend
cpsutah.org is not in the account's verified domains, so all CPS mail currently sends from our house sender (omnios.news). Verify cpsutah.org, then reply and I will re-point the sender.

2. Two campaigns are queued with senders that cannot send
Two active campaigns point at domains that are not in the Resend account, so both will fail at send time: rene@renelaveau.com and alfred@omnileadsagi.com. Tell me which sender each should use.

3. Homepage still titles as "Interlinked"
Every other page identifies as Omni AI; the homepage alone still reads Interlinked. Keep Interlinked, or move it to Omni AI?

4. Should /cps/marketing be gated?
It is publicly reachable and shows CPS lead counts, spend, and asset valuation to anyone with the link. Gate it behind auth, or leave it public?

Bonus: four empty legacy tables (psychcustody_*) still carry the old name. Zero rows, no code reads them. Renaming needs a migration, which I do not run on my own.

Links:
https://omnileadsagi.com/partners/cps
https://omnileadsagi.com/federation/case-studies/cps
https://omnileadsagi.com/cps/marketing
https://mythosais.com/dashboard

Reply with your four answers and I will handle the rest.`;

async function main() {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text }),
  });
  const body = await res.text();
  console.log(`STATUS ${res.status}`);
  console.log(body);
  if (!res.ok) process.exit(1);
}

main();
