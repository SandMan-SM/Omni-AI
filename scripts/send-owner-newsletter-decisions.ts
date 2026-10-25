// One-off: the owner-decision email for the newsletter publishing recovery.
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

const subject = "The newsletter is publishing again · three calls for you";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Owner Decisions</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">The daily issue had been publishing into a void since August 6. It publishes again now.</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    The cron had been writing an issue every single day and logging <strong style="color:#fafafa;">published: true</strong> every single day &mdash; but the write set the publish timestamp and left the row marked as a draft, so every reader (the issue page, the archive, the sitemap, the RSS feed) filtered it out. Nothing was broken in the logs. Eighty days of issues were written to the database and shown to nobody. That is fixed, verified against the live site, and a gate now fails the build if the same mistake comes back. Today&rsquo;s issue is live. Three things need you personally.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">1 · Do you want the 80-day backlog published?</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    About 160 issues from <strong style="color:#fafafa;">2026-08-07 through 2026-10-25</strong> are sitting in the database with a publish timestamp and a draft flag. Publishing them would put two months of issues on the public site, into the sitemap and into the RSS feed at once. It is your call how the archive reads, so I did not touch them. Publish them, publish a subset, or leave them as drafts?
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">2 · Which of the two daily rows is the issue?</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Every day produces <strong style="color:#fafafa;">two</strong> rows: one the site&rsquo;s cron writes (<code>interlinked-free-2026-10-25</code>, now published), and one a separate publisher writes from outside this repo (<code>free-ai-institutional-memory-2026-10-24</code>, published timestamp set, still flagged as a draft, so it never appears). The second one is the curated pipeline you run through the Hermes/Codex automation &mdash; is that supposed to be the one that publishes, and should I look at fixing it, or is the site&rsquo;s own issue enough?
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">3 · Two database migrations need your authorization</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The newsletter table&rsquo;s publish column defaults to <em>now()</em>, which is what let a draft look published. The right default is empty, and the four empty <code>psychcustody_*</code> tables still carry the old practice name. Both are migrations, and I do not run migrations on my own &mdash; say the word and I will do it in a migration session.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Also worth knowing</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The newsletter has still not <strong style="color:#fafafa;">emailed</strong> anyone since 2026-08-06 &mdash; only the publish-to-website step is scheduled on the site. Do you want me to wire the send into the site&rsquo;s own cron so it stops depending on the other automation? And the four CPS decisions from my last email are still open whenever you have a moment.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Where to look</h2>
  <ul style="font-size:14px;line-height:1.85;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li>Today&rsquo;s issue: <a href="https://omnileadsagi.com/newsletter/interlinked-free-2026-10-25" style="color:#f59e0b;">omnileadsagi.com/newsletter/interlinked-free-2026-10-25</a></li>
    <li>Archive: <a href="https://omnileadsagi.com/newsletter/archive" style="color:#f59e0b;">omnileadsagi.com/newsletter/archive</a></li>
    <li>Feed: <a href="https://omnileadsagi.com/newsletter/rss.xml" style="color:#f59e0b;">omnileadsagi.com/newsletter/rss.xml</a></li>
    <li>Operator dashboard: <a href="https://mythosais.com/dashboard" style="color:#f59e0b;">mythosais.com/dashboard</a></li>
  </ul>

  <p style="color:#71717a;font-size:12px;line-height:1.7;margin:28px 0 0 0;border-top:1px solid #27272a;padding-top:16px;">
    Reply to this email with your answers and I will handle the rest.
  </p>
</div>
</body></html>`;

const text = `The daily issue had been publishing into a void since August 6. It publishes again now.

The cron had been writing an issue every day and logging "published: true" every day, but the write set the publish timestamp and left the row marked as a draft, so every reader filtered it out. Eighty days of issues existed in the database and were shown to nobody. That is fixed, verified live, and a gate now fails the build if it comes back. Today's issue is live. Three things need you.

1. Do you want the 80-day backlog published?
About 160 issues from 2026-08-07 through 2026-10-25 have a publish timestamp and a draft flag. Publishing them would put two months of issues on the public site, into the sitemap and into the RSS feed at once. Publish them, publish a subset, or leave them as drafts?

2. Which of the two daily rows is the issue?
Every day produces two rows: one the site's cron writes (interlinked-free-2026-10-25, now published), and one a separate publisher writes from outside this repo (free-ai-institutional-memory-2026-10-24, publish timestamp set, still flagged draft, so it never appears). The second is the curated pipeline you run through the Hermes/Codex automation. Is that supposed to be the one that publishes, and should I look at fixing it?

3. Two database migrations need your authorization
The newsletter table's publish column defaults to now(), which is what let a draft look published; the right default is empty. The four empty psychcustody_* tables still carry the old practice name. Both are migrations and I do not run them on my own — say the word.

Also: the newsletter has still not emailed anyone since 2026-08-06. Do you want me to wire the send into the site's own cron? And the four CPS decisions from my last email are still open.

Links:
https://omnileadsagi.com/newsletter/interlinked-free-2026-10-25
https://omnileadsagi.com/newsletter/archive
https://omnileadsagi.com/newsletter/rss.xml
https://mythosais.com/dashboard

Reply with your answers and I will handle the rest.`;

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
