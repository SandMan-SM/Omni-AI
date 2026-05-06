// Pitches the 3 new Utah local-business newsroom projects to Sitani.
// Names + concepts + domain availability + Vercel project links.

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
const subject = "3 Utah-news projects scaffolded · pick names, pull triggers on domains";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · New Properties</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">Three Utah local-news scaffolds, ready for your call</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Per your request — three Vercel projects scaffolded as reputable local business newsrooms covering Utah. Each has its own brand voice, design language, and the cross-portfolio sponsor embed already wired in. Domains are all available; pick which you want and I&apos;ll buy + attach.
  </p>

  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e4e4e7;margin:0 0 24px 0;">
    <thead>
      <tr style="border-bottom:1px solid #27272a;">
        <th style="text-align:left;padding:10px 8px;color:#a1a1aa;font-weight:600;font-size:12px;letter-spacing:.05em;text-transform:uppercase;">Brand</th>
        <th style="text-align:left;padding:10px 8px;color:#a1a1aa;font-weight:600;font-size:12px;letter-spacing:.05em;text-transform:uppercase;">Vibe</th>
        <th style="text-align:left;padding:10px 8px;color:#a1a1aa;font-weight:600;font-size:12px;letter-spacing:.05em;text-transform:uppercase;">Domain</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #1a1a1a;">
        <td style="padding:14px 8px;vertical-align:top;">
          <div style="font-weight:700;color:#f5f5f4;">Utah Main Street</div>
          <div style="font-size:11px;color:#71717a;font-family:monospace;">utah-main-street</div>
        </td>
        <td style="padding:14px 8px;vertical-align:top;color:#d4d4d8;">
          Weekly broadsheet. Indigo + cream. &ldquo;Pulse of Utah&apos;s best businesses&rdquo; — features 4 operators a week.
        </td>
        <td style="padding:14px 8px;vertical-align:top;">
          <strong style="color:#10b981;">utahmainstreet.com</strong><br>
          <span style="font-size:11px;color:#71717a;">$11.25 / yr · available</span>
        </td>
      </tr>
      <tr style="border-bottom:1px solid #1a1a1a;">
        <td style="padding:14px 8px;vertical-align:top;">
          <div style="font-weight:700;color:#f5f5f4;">Beehive Biz Pulse</div>
          <div style="font-size:11px;color:#71717a;font-family:monospace;">beehive-biz-pulse</div>
        </td>
        <td style="padding:14px 8px;vertical-align:top;color:#d4d4d8;">
          Daily ticker. Amber + dark. Hiring / raising / opening / winning. 90 seconds, no scrolling.
        </td>
        <td style="padding:14px 8px;vertical-align:top;">
          <strong style="color:#10b981;">beehivebizpulse.com</strong><br>
          <span style="font-size:11px;color:#71717a;">$11.25 / yr · available</span>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 8px;vertical-align:top;">
          <div style="font-weight:700;color:#f5f5f4;">The Wasatch Post</div>
          <div style="font-size:11px;color:#71717a;font-family:monospace;">the-wasatch-post</div>
        </td>
        <td style="padding:14px 8px;vertical-align:top;color:#d4d4d8;">
          Light-mode broadsheet. Cream paper, black ink. Long-form investigative. Differentiated from the other two.
        </td>
        <td style="padding:14px 8px;vertical-align:top;">
          <strong style="color:#10b981;">thewasatchpost.com</strong><br>
          <span style="font-size:11px;color:#71717a;">$11.25 / yr · available</span>
        </td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Vercel projects (live)</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li><a href="https://vercel.com/sandman-sms-projects/utah-main-street" style="color:#f59e0b;">utah-main-street</a> — first deploy in flight</li>
    <li><a href="https://vercel.com/sandman-sms-projects/beehive-biz-pulse" style="color:#f59e0b;">beehive-biz-pulse</a> — first deploy in flight</li>
    <li><a href="https://vercel.com/sandman-sms-projects/the-wasatch-post" style="color:#f59e0b;">the-wasatch-post</a> — first deploy in flight</li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">What's already wired</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li>Cross-portfolio sponsor embed (Fred + Live Better Podcast) loads from omnileadsagi.com on every page.</li>
    <li>Per-site analytics slugs: <code>mainst</code>, <code>beehive</code>, <code>wasatch</code>. Migrations needed for these in Supabase before the dashboard sees rows — added to your existing punchlist.</li>
    <li>Brand-distinct designs so all three look like separate publications, not three skins of the same template.</li>
    <li>SEO metadata + Open Graph + Twitter cards on the layout — shareable from day one.</li>
    <li>Editor email aliases stubbed (<code>editor@</code>, <code>tips@</code>, <code>desk@</code>) so as soon as you attach domains the inbound looks legit.</li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Pull the trigger when ready</h2>
  <p style="color:#e4e4e7;font-size:14px;line-height:1.65;margin:0 0 8px 0;">
    Reply with which (or all three) you want and I&apos;ll buy via Vercel domain checkout, attach to the matching project, and email you the SSL-live URL inside ~10 minutes.
  </p>

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #27272a;color:#71717a;font-size:12px;">
    All three are also push-deployed from <code>~/Desktop/Clients/Utah-Main-Street</code>, <code>/Beehive-Biz-Pulse</code>, <code>/Wasatch-Post</code> — push to GitHub when you&apos;re ready and Vercel will start auto-deploying on commit.
  </div>
</div>
</body></html>`;

const text = `3 Utah local-news projects scaffolded.

UTAH MAIN STREET — utahmainstreet.com (avail $11.25/yr)
Weekly broadsheet. Indigo + cream. Features 4 operators / week.
https://vercel.com/sandman-sms-projects/utah-main-street

BEEHIVE BIZ PULSE — beehivebizpulse.com (avail $11.25/yr)
Daily ticker. Amber + dark. Hiring/raising/opening/winning lines.
https://vercel.com/sandman-sms-projects/beehive-biz-pulse

THE WASATCH POST — thewasatchpost.com (avail $11.25/yr)
Light-mode broadsheet. Long-form investigative. Differentiated.
https://vercel.com/sandman-sms-projects/the-wasatch-post

What's already wired in each:
- Cross-portfolio sponsor embed (Fred + LBP)
- Per-site analytics slugs: mainst / beehive / wasatch (migrations needed)
- Brand-distinct designs
- Full SEO + OG + Twitter card metadata
- Editor email aliases stubbed

Reply with which to buy + attach. Push to GitHub when you want auto-deploys.
`;

async function main() {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { console.error("Send failed:", res.status, body); process.exit(1); }
  console.log("Sent:", body.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
