// Debrief: what just got built + where to view it. Sent from Alfred to
// Sitani so the deliverable is captured in the same email thread the
// punchlist arrived in.

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

const FROM = "Alfred (Omni AI) <alfred@omnileadsagi.com>";
const TO = "sitanim8@gmail.com";

const subject = "Built · Portfolio promotion system (Fred + Live Better Podcast embed)";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Build Debrief</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">Portfolio promotion system is live</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Built today: a single sponsor + partner block that drops into any portfolio site with two lines of HTML. Fred Circle gets the primary slot, Live Better Podcast gets the partnership slot. All clicks, shares, and subscribes are visible in the Mythos agentic dashboard.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">View it</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li>Live system page (with the actual block embedded as demo): <a href="https://omnileadsagi.com/system" style="color:#f59e0b;">omnileadsagi.com/system</a></li>
    <li>Live on every newsletter post too — bottom of <a href="https://omnileadsagi.com/newsletter" style="color:#f59e0b;">omnileadsagi.com/newsletter</a></li>
    <li>Universal embed JS (what client sites pull): <a href="https://omnileadsagi.com/embed/sponsor.js" style="color:#f59e0b;">omnileadsagi.com/embed/sponsor.js</a></li>
    <li>Attribution dashboard: <a href="https://mythosais.com/dashboard" style="color:#f59e0b;">mythosais.com/dashboard</a></li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">What got built</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li><strong>SponsorBlock</strong> (React component) — Fred primary card, LBP secondary card, share rows on each, newsletter capture under both.</li>
    <li><strong>ShareControls</strong> — native Web Share API on mobile + per-platform intents (X, LinkedIn, SMS, email, copy-link) on desktop. Every click pings analytics.</li>
    <li><strong>NewsletterCaptureMini</strong> — single-field email capture that posts to inbound_&lt;slug&gt;_leads with source=&apos;newsletter_subscribe&apos;.</li>
    <li><strong>Universal embed at /embed/sponsor.js</strong> — vanilla JS, zero React on receiving end. Drops into ANY framework / static site / WordPress with two lines.</li>
    <li><strong>System landing page at /system</strong> — public docs for Fred, Jaime, future sponsors so they can see exactly how lead-gen flows back to them.</li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">UTM attribution</h2>
  <p style="color:#e4e4e7;font-size:14px;line-height:1.65;margin:0 0 8px 0;">
    Outbound links are tagged so Fred + Jaime can see attribution in their own analytics:
  </p>
  <pre style="background:#1a1a1a;border:1px solid #27272a;border-radius:6px;padding:12px 14px;color:#a1a1aa;font-size:12px;line-height:1.55;margin:0 0 16px 0;overflow-x:auto;">utm_source=omni-&lt;slug&gt;
utm_medium=newsletter
utm_campaign=fred-circle | live-better-podcast</pre>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Drop-in for every client site</h2>
  <pre style="background:#1a1a1a;border:1px solid #27272a;border-radius:6px;padding:12px 14px;color:#e4e4e7;font-size:12px;line-height:1.65;margin:0 0 16px 0;overflow-x:auto;">&lt;div id="omni-sponsor" data-slug="cps"&gt;&lt;/div&gt;
&lt;script src="https://omnileadsagi.com/embed/sponsor.js" defer&gt;&lt;/script&gt;</pre>
  <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0 0 16px 0;">
    Slugs: <code>omnileads</code>, <code>cps</code>, <code>leifson</code>, <code>youngs</code>, <code>ltb</code>, <code>alira</code>, <code>phoenix</code>, <code>niki</code>, <code>prime_iv</code> (= Live Better Podcast / On The Drip).
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Still on you</h2>
  <p style="color:#e4e4e7;font-size:14px;line-height:1.65;margin:0;">
    See the earlier punchlist email — secretimperium build is in ERROR, four domains have no Vercel project, and the embed needs to be pasted into each client repo + the LBP repo (you have GoDaddy access). Reply &ldquo;done&rdquo; per item or just point at what&apos;s next.
  </p>

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #27272a;color:#71717a;font-size:12px;">
    Continuing to build. Watch the GitHub commit feed for live progress.
  </div>
</div>
</body></html>`;

const text = `Portfolio promotion system is live.

VIEW
- /system page: https://omnileadsagi.com/system  (live demo of the block)
- Live on every newsletter post (bottom).
- Universal embed: https://omnileadsagi.com/embed/sponsor.js
- Attribution dashboard: https://mythosais.com/dashboard

BUILT
- SponsorBlock (Fred primary, LBP secondary)
- ShareControls (native + intents)
- NewsletterCaptureMini (posts to inbound_<slug>_leads)
- Universal /embed/sponsor.js (vanilla JS, drops into any site)
- System landing /system (docs for sponsors / partners)

UTM
utm_source=omni-<slug>
utm_medium=newsletter
utm_campaign=fred-circle | live-better-podcast

DROP-IN
<div id="omni-sponsor" data-slug="cps"></div>
<script src="https://omnileadsagi.com/embed/sponsor.js" defer></script>

Slugs: omnileads, cps, leifson, youngs, ltb, alira, phoenix, niki, prime_iv (= LBP / On The Drip).

STILL ON YOU
See the earlier punchlist email — secretimperium ERROR, four domains with no projects,
and the embed needs to be pasted into each client repo + the LBP repo (you have GoDaddy).
`;

async function main() {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend send failed:", res.status, body);
    process.exit(1);
  }
  console.log("Sent:", body.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
