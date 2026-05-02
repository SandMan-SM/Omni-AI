/**
 * Sends the launch announcement to Adam (Leifson), Brent (Youngs), and
 * Korine + Steve (CPS). CTA links to each partner's co-branded landing
 * at omnileadsagi.com/partners/<slug>.
 *
 * Bulletproof email HTML:
 *   - Table-based outer scaffold (Outlook 2016+ ignores divs for layout)
 *   - 100% inline styles (Gmail strips <style>)
 *   - Max width 600px, single-column on mobile
 *   - System font stack only (no remote font fetch)
 *   - bgcolor attributes on cells alongside CSS for legacy Outlook
 *   - Bulletproof button: padded <a> over an Outlook MSO conditional
 *
 * Run from the Omni AI Website root:
 *   npx tsx scripts/send-client-launch-emails.ts                # send for real
 *   npx tsx scripts/send-client-launch-emails.ts --dry-run      # print previews only
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const DRY_RUN = process.argv.includes("--dry-run");
const PREVIEW_PATH = path.resolve(process.cwd(), "scripts/.email-previews");
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!DRY_RUN && !RESEND_API_KEY) {
  console.error("RESEND_API_KEY missing in .env.local. Aborting.");
  process.exit(1);
}

const FROM = "Sitani at Omni AI <bookings@omnileadsagi.com>";
const REPLY_TO = "sitanim8@gmail.com";

type Recipient = {
  label: string;
  to: string;
  cc: string[];
  firstName: string;
  brandLine: string;
  intro: string;
  subject: string;
  partnerSlug: "cps" | "leifson" | "youngs";
};

const VALUE_PITCH =
  "Most marketing tools collect leads after they show up. Agentic personalized marketing runs the whole loop — the agents source, qualify, and route the leads themselves, then learn what's working and double down. Every page someone reads, every button they touch, every call they place feeds the system. The result is a marketing engine that doesn't just measure your business — it grows it, autonomously, every day.";

const RECIPIENTS: Recipient[] = [
  {
    label: "Adam — Leifson Built",
    to: "Adam@leifsonbuilt.com",
    cc: ["benjones@omnileadsllc.com", "sitanim8@gmail.com"],
    firstName: "Adam",
    brandLine: "Leifson Built",
    intro:
      "Quick note from the Omni AI side: your agentic dashboard is officially live, and we ran a test pass that loaded 100 qualified leads into your pipeline. Decks, basements, kitchens, baths — all scoped to Leifson Built and ready to be worked.",
    subject: "Adam — Leifson Built is live on Omni AI (100 leads loaded)",
    partnerSlug: "leifson",
  },
  {
    label: "Brent — Young's Cabinet Refinishing",
    to: "youngscabinetrefinishing@gmail.com",
    cc: ["benjones@omnileadsllc.com", "sitanim8@gmail.com"],
    firstName: "Brent",
    brandLine: "Young's Cabinet Refinishing",
    intro:
      "Quick note from the Omni AI side: your agentic dashboard is officially live, and we ran a test pass that loaded 100 qualified leads into your Youngs pipeline so the system isn't sitting cold on day one. Cabinet refinishing buyers across the Wasatch Front, ready to be worked.",
    subject: "Brent — Young's Cabinet Refinishing is live on Omni AI (100 leads loaded)",
    partnerSlug: "youngs",
  },
  {
    label: "Korine + Steve — CPS",
    to: "korine@wecanhelpout.com",
    cc: ["steve@wecanhelpout.com", "benjones@omnileadsllc.com", "sitanim8@gmail.com"],
    firstName: "Korine & Steve",
    brandLine: "Comprehensive Psychological Services",
    intro:
      "Quick note from the Omni AI side: the CPS agentic dashboard is officially live, and we loaded 100 qualified leads into your pipeline as a test pass — neuropsych, ADHD, custody-eval, and ketamine intent across the Salt Lake area, all scoped to CPS so the team has a warm queue from day one.",
    subject: "CPS is live on Omni AI (100 leads loaded)",
    partnerSlug: "cps",
  },
];

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(r: Recipient): string {
  const partnerUrl = `https://omnileadsagi.com/partners/${r.partnerSlug}`;
  const dashboardUrl = "https://omnileadsagi.com/dashboard";
  const firstName = escape(r.firstName);
  const brandLine = escape(r.brandLine);
  const intro = escape(r.intro);
  const valuePitch = escape(VALUE_PITCH);

  // Bulletproof button (works in Outlook 2007+ via VML, all others via styled <a>).
  const button = (label: string, href: string) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
      <tr>
        <td align="center" bgcolor="#10b981" style="border-radius:12px;background-image:linear-gradient(90deg,#10b981,#06b6d4);">
          <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="25%" stroke="f" fillcolor="#10b981">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;letter-spacing:0.02em;">${escape(label)}</center>
            </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
            <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;mso-hide:all;">${escape(label)}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escape(r.subject)}</title>
<!--[if mso]>
<style type="text/css">table {border-collapse:collapse;border-spacing:0;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Your agentic dashboard is live. 100 qualified leads loaded into your ${brandLine} pipeline as a test pass.
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f6f7f9" style="background-color:#f6f7f9;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <tr>
          <td style="height:6px;line-height:6px;font-size:6px;background:linear-gradient(90deg,#9333ea,#06b6d4,#22c55e);">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#ecfdf5;color:#047857;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
              Omni AI &nbsp;·&nbsp; Agentic Infrastructure Live
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 32px 0 32px;">
            <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              ${firstName} — your agentic dashboard is live, and 100 leads are already inside.
            </h1>
            <p style="margin:0 0 18px 0;font-size:15px;color:#334155;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              ${intro}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 32px 6px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0f172a" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
                  <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7dd3fc;font-weight:700;margin-bottom:8px;">What we just shipped for you</div>
                  <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#e2e8f0;line-height:1.65;">
                    <li>A fully agentic command center scoped to your business</li>
                    <li>Live website analytics — every page view, every click, every form, every scroll</li>
                    <li>100 qualified leads loaded as a test run so the pipeline is warm on day one</li>
                    <li>A personal arena agent you can rename and watch climb the leaderboard</li>
                  </ul>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <h2 style="margin:0 0 8px 0;font-size:16px;font-weight:700;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              Why this is different than traditional marketing
            </h2>
            <p style="margin:0 0 14px 0;font-size:15px;color:#334155;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              ${valuePitch}
            </p>
            <p style="margin:14px 0;font-size:15px;color:#334155;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              We're running one of the most advanced agentic marketing infrastructures on earth — autonomous lead generation, live analytics, content engines, and decision logic that compounds. ${brandLine} is now plugged into it.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:14px 32px 8px 32px;">
            ${button("See the partnership →", partnerUrl)}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 24px 32px;">
            <a href="${dashboardUrl}" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:#475569;text-decoration:underline;">
              Or open your dashboard
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              Hit reply if anything looks off, if you want a walkthrough, or if you'd like Ben to schedule a quick call to show you around.
            </p>
            <p style="margin:14px 0 0 0;font-size:14px;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
              — Sitani &amp; the Omni AI team
            </p>
          </td>
        </tr>
        <tr>
          <td style="height:6px;line-height:6px;font-size:6px;background:linear-gradient(90deg,#22c55e,#06b6d4,#9333ea);">&nbsp;</td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
        <tr>
          <td align="center" style="padding:14px 16px 0 16px;font-size:11px;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:0.04em;">
            Omni AI &nbsp;·&nbsp; <a href="https://omnileadsagi.com" style="color:#94a3b8;text-decoration:none;">omnileadsagi.com</a> &nbsp;·&nbsp; Salt Lake City, UT
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildPlain(r: Recipient): string {
  const partnerUrl = `https://omnileadsagi.com/partners/${r.partnerSlug}`;
  return [
    `${r.firstName} — your agentic dashboard is live, and 100 leads are already inside.`,
    "",
    r.intro,
    "",
    "What we just shipped for you:",
    "  • A fully agentic command center scoped to your business",
    "  • Live website analytics — every page view, click, form, scroll",
    "  • 100 qualified leads loaded as a test run",
    "  • A personal arena agent you can rename and watch climb the leaderboard",
    "",
    "Why this is different than traditional marketing:",
    VALUE_PITCH,
    "",
    `We're running one of the most advanced agentic marketing infrastructures on earth — autonomous lead generation, live analytics, content engines, decision logic that compounds. ${r.brandLine} is plugged into it.`,
    "",
    `See the partnership: ${partnerUrl}`,
    "Open your dashboard: https://omnileadsagi.com/dashboard",
    "",
    "Hit reply if anything looks off or if you'd like Ben to schedule a quick walkthrough.",
    "",
    "— Sitani & the Omni AI team",
    "omnileadsagi.com",
  ].join("\n");
}

async function send(args: {
  to: string;
  cc: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      cc: args.cc,
      reply_to: REPLY_TO,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: JSON.stringify(data) };
  return { ok: true, id: (data as { id?: string }).id };
}

(async () => {
  if (DRY_RUN) {
    fs.mkdirSync(PREVIEW_PATH, { recursive: true });
    for (const r of RECIPIENTS) {
      const html = buildHtml(r);
      const text = buildPlain(r);
      const file = path.join(PREVIEW_PATH, `${r.partnerSlug}.html`);
      fs.writeFileSync(file, html, "utf8");
      const txtFile = path.join(PREVIEW_PATH, `${r.partnerSlug}.txt`);
      fs.writeFileSync(txtFile, text, "utf8");
      console.log(`Preview written → ${file}`);
      console.log(`  To: ${r.to}`);
      console.log(`  Cc: ${r.cc.join(", ")}`);
      console.log(`  Subject: ${r.subject}`);
      console.log("");
    }
    console.log(`All ${RECIPIENTS.length} previews ready in ${PREVIEW_PATH}`);
    console.log("Open the .html files in any browser to verify rendering.");
    return;
  }

  for (const r of RECIPIENTS) {
    const html = buildHtml(r);
    const text = buildPlain(r);
    process.stdout.write(`Sending → ${r.label} ... `);
    const result = await send({ to: r.to, cc: r.cc, subject: r.subject, html, text });
    if (result.ok) console.log(`OK ${result.id}`);
    else console.log(`FAIL ${result.error}`);
  }
})();
