// One-shot Resend send: portfolio audit punch-list to Sitani.
// Run with: npx tsx scripts/send-portfolio-punchlist.ts
//
// Mirrors the From + To convention CLAUDE.md sets for owner-side
// notifications: from alfred@omnileadsagi.com → to sitanim8@gmail.com.

// Read .env.local manually to avoid an extra dep. Skip BOM and comments.
import * as fs from "fs";
import * as path from "path";

function loadEnvLocal() {
  // ESM context — process.cwd() is the npm-script invocation dir.
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

const FROM = "Alfred (Omni AI) <alfred@omnileadsagi.com>";
const TO = "sitanim8@gmail.com";

const subject = "Portfolio audit · personal action items (read-out from automation)";

// Plain HTML — render-safe in Gmail / Apple Mail / Outlook.
const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Portfolio audit</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;">Things only you can do</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Automation has the rubric pieces in place — sponsor block (Fred + Live Better Podcast),
    share controls, newsletter capture, cross-domain embed, and analytics visible in
    the Mythos agentic dashboard. Below is what needs <strong>your</strong> hands.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">1 · Vercel domain attachments</h2>
  <ul style="font-size:14px;line-height:1.8;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li><strong>secretimperium.com</strong> — registered today on Namecheap but not attached to the imperium project. The latest imperium deploy is also ERROR — likely needs a build fix before attach. Open <a href="https://vercel.com/sandman-sms-projects/imperium" style="color:#f59e0b;">project</a>, fix build, then Settings → Domains → Add.</li>
    <li><strong>phoenixexteriors.com</strong> and <strong>nikifellow.com</strong> — Vercel projects exist (phoenix-exteriors-site, nikki-fellows-site) but no domains attached and you don&apos;t own the domains in Namecheap. Buy them or skip.</li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">2 · Domains without Vercel projects</h2>
  <ul style="font-size:14px;line-height:1.8;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li><strong>aidigitalmarketingsolution.com</strong> — local repo at <code>~/Desktop/Clients/AI-Digital-Marketing</code>, no Vercel project yet. Need to <code>vercel link</code> + push.</li>
    <li><strong>seoandppcmarketing.com</strong> — local repo at <code>~/Desktop/Clients/SEO-PPC</code>, same situation.</li>
    <li><strong>agiarena.online</strong> — registered but no repo or project. What goes here?</li>
    <li><strong>sitanimafi.live</strong> — registered but no repo or project. Personal site?</li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">3 · Live Better Podcast (Jaime / GoDaddy)</h2>
  <ul style="font-size:14px;line-height:1.8;color:#e4e4e7;padding-left:20px;margin:0 0 16px 0;">
    <li>Domain is at GoDaddy under Jaime&apos;s account (per your direction — leave hosting alone).</li>
    <li>The on-the-drip-deploy Vercel project IS serving livebetteronthedrip.com — fully wired.</li>
    <li>Open the on-the-drip-deploy repo and add this one-liner to the homepage <code>&lt;body&gt;</code> or footer:<br>
      <code style="display:block;background:#1a1a1a;color:#a1a1aa;padding:10px 14px;border-radius:6px;margin-top:8px;font-size:12px;">&lt;div id="omni-sponsor" data-slug="prime_iv"&gt;&lt;/div&gt;<br>&lt;script src="https://omnileadsagi.com/embed/sponsor.js" defer&gt;&lt;/script&gt;</code>
      That&apos;s the embed — Fred&apos;s sponsor card + Live Better Podcast partnership card render automatically. Analytics are visible in <a href="https://mythosais.com/dashboard" style="color:#f59e0b;">the Mythos dashboard</a>.
    </li>
  </ul>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">4 · Embed deployment per client site</h2>
  <p style="color:#e4e4e7;font-size:14px;line-height:1.6;margin:0 0 8px 0;">Same one-liner needs to drop into each client repo:</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e4e4e7;margin:0 0 16px 0;">
    <tr style="border-bottom:1px solid #27272a;"><th style="text-align:left;padding:8px;color:#a1a1aa;font-weight:600;">Site</th><th style="text-align:left;padding:8px;color:#a1a1aa;font-weight:600;">Slug to use</th></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">CPS</td><td style="padding:8px;"><code>cps</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">Leifson Built</td><td style="padding:8px;"><code>leifson</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">Youngs Cabinets</td><td style="padding:8px;"><code>youngs</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">Love Thy Barber</td><td style="padding:8px;"><code>ltb</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">Alira</td><td style="padding:8px;"><code>alira</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">Phoenix Exteriors</td><td style="padding:8px;"><code>phoenix</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">Nikki Fellows</td><td style="padding:8px;"><code>niki</code></td></tr>
    <tr style="border-bottom:1px solid #1a1a1a;"><td style="padding:8px;">On The Drip / Live Better Podcast</td><td style="padding:8px;"><code>prime_iv</code></td></tr>
    <tr><td style="padding:8px;">Omni Leads (omnileads.shop)</td><td style="padding:8px;"><code>omnileads</code></td></tr>
  </table>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">5 · Per-tenant Supabase tables (DB migration needed)</h2>
  <p style="color:#e4e4e7;font-size:14px;line-height:1.6;margin:0 0 8px 0;">
    Sites that don&apos;t have <code>inbound_&lt;slug&gt;_*</code> tables yet (imperium, agiarena, sitanimafi, ai_digital, seo_ppc) will silently 404 their analytics pings. Apply a migration that mirrors the existing per-slug schema — I won&apos;t run migrations autonomously per the project rule.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">6 · Sponsor copy review</h2>
  <p style="color:#e4e4e7;font-size:14px;line-height:1.6;margin:0;">
    The Fred card currently reads &ldquo;Live with the Host — sponsor of this dispatch.&rdquo; If you have headline copy you want from Fred himself, paste it and I&apos;ll swap. Same for the Live Better Podcast subhead (currently &ldquo;Show + community from our partner Jaime&rdquo;).
  </p>

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #27272a;color:#71717a;font-size:12px;">
    Auto-sent by automation when the rubric pieces landed. Reply with &ldquo;done&rdquo; per item, or just point at the next thing.
  </div>
</div>
</body></html>`;

const text = `Omni AI · Portfolio audit · personal action items

1. VERCEL DOMAIN ATTACHMENTS
- secretimperium.com: registered today, not attached. Imperium last deploy = ERROR. Fix build + attach.
- phoenixexteriors.com / nikifellow.com: projects exist, no domains, you don't own them. Buy or skip.

2. DOMAINS WITHOUT PROJECTS
- aidigitalmarketingsolution.com: local repo at ~/Desktop/Clients/AI-Digital-Marketing, no Vercel project. vercel link + push.
- seoandppcmarketing.com: same, local repo at ~/Desktop/Clients/SEO-PPC.
- agiarena.online: no repo. What's going here?
- sitanimafi.live: no repo. Personal site?

3. LIVE BETTER PODCAST
- Domain GoDaddy/Jaime — leave hosting alone (per your direction).
- on-the-drip-deploy Vercel is serving livebetteronthedrip.com OK.
- Drop into the homepage:
    <div id="omni-sponsor" data-slug="prime_iv"></div>
    <script src="https://omnileadsagi.com/embed/sponsor.js" defer></script>

4. EMBED ON EVERY SITE
- CPS=cps, Leifson=leifson, Youngs=youngs, LTB=ltb, Alira=alira,
  Phoenix=phoenix, Nikki=niki, OnTheDrip/LBP=prime_iv, OmniLeads=omnileads.

5. SUPABASE TABLES
- New slugs (imperium, agiarena, sitanimafi, ai_digital, seo_ppc) need inbound_<slug>_*
  tables before pings work. Apply migration mirroring existing per-slug schema.

6. SPONSOR COPY
- Confirm or override the Fred + LBP card copy.
`;

async function main() {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject,
      html,
      text,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend send failed:", res.status, body);
    process.exit(1);
  }
  console.log("Sent:", body.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
