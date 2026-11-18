// One-off: the consolidated owner-decision email for session 70.
//
// The last owner email went out 2026-11-01. Since then the fleet sweeps
// have measured more, and five decisions have accumulated that only the
// operator can make — each of them a DECISION, not a fix:
//
//   1. `OMNI_AUTH_TOKEN_SECRET` — the one variable the whole login
//      hardening is waiting on. Nothing can be deployed until the owner
//      chooses the secret and sets it on the edge and on every consuming
//      Vercel project.
//   2. 54 stale copies of the site carry a forgeable bearer — 35 of them
//      linked to the PRODUCTION Vercel project. Patch or retire is the
//      operator's call, because retiring one disposes of work only he can
//      judge.
//   3. `omnileads.shop` has no row in `federation.surfaces`, so its fix
//      cannot ship. There is no write path to that table from this agent.
//   4. Four empty `psychcustody_*` tables need a migration session.
//   5. `profiles.agent_name` renders real people's names on the public
//      arena — content the owner manages.
//
// The email closes with the short list still open from the earlier emails,
// so one reply can cover all of it.
//
// Sent from the house sender (omnios.news), which is a verified Resend
// domain. `omnileadsagi.com` is NOT in the Resend account — see
// lib/sender-registry.ts.

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
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}

const FROM = "Omni AI <bookings@omnios.news>";
const TO = "sitanim8@gmail.com";

const subject = "Five decisions waiting on you · one secret unblocks the whole login hardening";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Needs You</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">Five decisions waiting on you. One of them is a single secret that unblocks everything else.</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Nothing here is on fire, and none of it is a defect I can fix on my own. Each item below is a decision only you can make &mdash; a secret to choose, a folder to retire, a row to add, a migration to authorise, a piece of content to change. I measured the numbers fresh today rather than quoting my own notes, so they are current.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">1 · One secret unblocks the login hardening across every site</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Production&rsquo;s shared <code>auth-login</code> edge function still mints <strong style="color:#fafafa;">unsigned</strong> login tokens &mdash; it base64-encodes a JSON payload with no signature over it. The hardened copy in this repo signs the token and is ready to deploy, but I am deliberately not deploying it, for two reasons.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    First, flipping it is a cross-client breaking change. I measured the fleet for this today: <strong style="color:#fafafa;">32 trees</strong> would accept a signed token; <strong style="color:#fafafa;">22</strong> would reject it, because their server decodes a raw bearer. Those 22 have to be migrated <em>before</em> the mint moves, not after &mdash; otherwise they lock their own operators out.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Second, and more urgently, <strong style="color:#fafafa;">the signing secret does not exist yet</strong>: <code>OMNI_AUTH_TOKEN_SECRET</code> is set on neither side. The Supabase project holds <em>two</em> service-role secrets with different digests, and the flagship&rsquo;s production value is sensitive, so it comes back blank on a pull. A token signed at the edge with a secret the server does not share would be rejected by every server that should accept it.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The order is not optional: set <strong style="color:#fafafa;">one explicit secret</strong> on the edge and on every consuming Vercel project &rarr; migrate the 22 raw-bearer verifiers &rarr; then flip the mint and deploy. One honest note: the unsigned mint is not independently exploitable &mdash; it hands an admin token only to a caller who already holds operator credentials. The exploitable hole is the raw-bearer <em>decoder</em> on the consumer side, and no mint-side change can close that one.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">2 · 54 stale copies of the site &mdash; patch them, or retire them</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The sweep now examines <strong style="color:#fafafa;">408 site trees</strong> on this machine. <strong style="color:#fafafa;">54 of them</strong> still carry the unsigned edge-function copy or a server that decodes a bearer without verifying it &mdash; and <strong style="color:#fafafa;">35 of those 54 are linked to the production Vercel project</strong>, so a <code>vercel --prod</code> from any of them would ship it. The fix is ready and I can carry it mechanically to every one of them. What I will not do on my own is decide that a given copy is disposable, because retiring one disposes of work only you can judge. Patch all 54, retire the ones you no longer need, or tell me which are live and I will patch only those.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">3 · omnileads.shop is one database row away from shipping</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The Omni Leads checkout had a real defect: its landing page read two locked tables with the anonymous client, so the route could never render. It is fixed and committed locally. It cannot ship because <code>federation.surfaces</code> has no row for that domain, and the federation protocol says a missing row means stop &mdash; and there is no write path to that table from my side. The row to add is: domain <code>omnileads.shop</code>, its Vercel project, codebase <code>/Users/janahasson/Desktop/Clients/Omni Leads/Website</code>, deploy method CLI. Add it and I will ship the fix the same hour.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">4 · Four empty tables still carry the old practice&rsquo;s name</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    <code>psychcustody_contacts</code>, <code>psychcustody_campaigns</code>, <code>psychcustody_campaign_sends</code> and <code>psychcustody_contact_events</code> are empty and unreferenced by code, so renaming them to <code>cps_*</code> is cosmetic &mdash; but it is a migration, and I do not run migrations on my own. Say the word and I will do it in a migration session.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">5 · The public leaderboard shows real people&rsquo;s names</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The arena leaderboard renders <code>agent_name</code> from the <code>profiles</code> table, and several rows carry a human name &mdash; yours among them. I removed the separate <code>ownerName</code> field from the public response earlier, but the column itself holds what you set it to. Anonymise those rows, or leave them as they are?
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Still open from my earlier emails</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li><code>cpsutah.org</code> is still not verified in Resend, so all CPS mail goes out from our house sender.</li>
    <li>Two <code>marketing_campaigns</code> rows are still marked active with senders that 403 at send time (<code>rene@renelaveau.com</code> and <code>alfred@omnileadsagi.com</code>). They need a sender re-point, not a code fix.</li>
    <li>The homepage still titles as &ldquo;Interlinked&rdquo; while every other page says Omni AI.</li>
    <li><code>/cps/marketing</code> still loads for anyone with the URL; the numbers behind it now require a sign-in.</li>
    <li>The ~80 days of newsletter issues are still drafts &mdash; publish them, publish a subset, or leave them.</li>
    <li>Which of the two daily rows is the intended issue: the site&rsquo;s own cron, or the curated publisher outside this repo that still writes rows nobody sees?</li>
    <li>The newsletter has still not emailed anyone since 2026-08-06 &mdash; only the publish-to-website step is scheduled.</li>
    <li>Four old copies of this site have a broken git link and still point at production (emailed 1 November). They are still there.</li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Where to look</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li>Operator dashboard: <a href="https://mythosais.com/dashboard" style="color:#f59e0b;">mythosais.com/dashboard</a></li>
    <li>Public site: <a href="https://omnileadsagi.com" style="color:#f59e0b;">omnileadsagi.com</a></li>
    <li>Arena leaderboard: <a href="https://omnileadsagi.com/arena" style="color:#f59e0b;">omnileadsagi.com/arena</a></li>
  </ul>

  <p style="color:#71717a;font-size:12px;line-height:1.7;margin:28px 0 0 0;border-top:1px solid #27272a;padding-top:16px;">
    Reply to this email with your answers and I will handle the rest. Numbered answers are easiest &mdash; one line each is enough for the first four.
  </p>
</div>
</body></html>`;

const text = `Five decisions waiting on you. One of them is a single secret that unblocks everything else.

Nothing here is on fire, and none of it is a defect I can fix on my own. Each item below is a decision only you can make. I measured the numbers fresh today rather than quoting my own notes, so they are current.

1. One secret unblocks the login hardening across every site
Production's shared auth-login edge function still mints UNSIGNED login tokens - it base64-encodes a JSON payload with no signature over it. The hardened copy in this repo signs the token and is ready to deploy, but I am deliberately not deploying it, for two reasons.

First, flipping it is a cross-client breaking change. I measured the fleet for this today: 32 trees would accept a signed token; 22 would reject it, because their server decodes a raw bearer. Those 22 have to be migrated BEFORE the mint moves, not after - otherwise they lock their own operators out.

Second, and more urgently, the signing secret does not exist yet: OMNI_AUTH_TOKEN_SECRET is set on neither side. The Supabase project holds two service-role secrets with different digests, and the flagship's production value is sensitive, so it comes back blank on a pull. A token signed at the edge with a secret the server does not share would be rejected by every server that should accept it.

The order is not optional: set one explicit secret on the edge and on every consuming Vercel project, then migrate the 22 raw-bearer verifiers, then flip the mint and deploy. One honest note: the unsigned mint is not independently exploitable - it hands an admin token only to a caller who already holds operator credentials. The exploitable hole is the raw-bearer DECODER on the consumer side, and no mint-side change can close that one.

2. 54 stale copies of the site - patch them, or retire them
The sweep now examines 408 site trees on this machine. 54 of them still carry the unsigned edge-function copy or a server that decodes a bearer without verifying it - and 35 of those 54 are linked to the production Vercel project, so a vercel --prod from any of them would ship it. The fix is ready and I can carry it mechanically to every one of them. What I will not do on my own is decide that a given copy is disposable, because retiring one disposes of work only you can judge. Patch all 54, retire the ones you no longer need, or tell me which are live and I will patch only those.

3. omnileads.shop is one database row away from shipping
The Omni Leads checkout had a real defect: its landing page read two locked tables with the anonymous client, so the route could never render. It is fixed and committed locally. It cannot ship because federation.surfaces has no row for that domain, and the federation protocol says a missing row means stop - and there is no write path to that table from my side. The row to add is: domain omnileads.shop, its Vercel project, codebase /Users/janahasson/Desktop/Clients/Omni Leads/Website, deploy method CLI. Add it and I will ship the fix the same hour.

4. Four empty tables still carry the old practice's name
psychcustody_contacts, psychcustody_campaigns, psychcustody_campaign_sends and psychcustody_contact_events are empty and unreferenced by code, so renaming them to cps_* is cosmetic - but it is a migration, and I do not run migrations on my own. Say the word and I will do it in a migration session.

5. The public leaderboard shows real people's names
The arena leaderboard renders agent_name from the profiles table, and several rows carry a human name - yours among them. I removed the separate ownerName field from the public response earlier, but the column itself holds what you set it to. Anonymise those rows, or leave them as they are?

Still open from my earlier emails:
- cpsutah.org is still not verified in Resend, so all CPS mail goes out from our house sender.
- Two marketing_campaigns rows are still marked active with senders that 403 at send time (rene@renelaveau.com and alfred@omnileadsagi.com). They need a sender re-point, not a code fix.
- The homepage still titles as "Interlinked" while every other page says Omni AI.
- /cps/marketing still loads for anyone with the URL; the numbers behind it now require a sign-in.
- The ~80 days of newsletter issues are still drafts - publish them, publish a subset, or leave them.
- Which of the two daily rows is the intended issue: the site's own cron, or the curated publisher outside this repo that still writes rows nobody sees?
- The newsletter has still not emailed anyone since 2026-08-06 - only the publish-to-website step is scheduled.
- Four old copies of this site have a broken git link and still point at production (emailed 1 November). They are still there.

Links:
https://mythosais.com/dashboard
https://omnileadsagi.com
https://omnileadsagi.com/arena

Reply with your answers and I will handle the rest. Numbered answers are easiest - one line each is enough for the first four.`;

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
