// One-off: the owner-action email for session 50.
//
// Two items need him personally:
//   1. The Telegram bot token in Vercel is revoked by Telegram (401 on
//      getMe). The webhook route now verifies a secret token, so a new
//      token has to be issued and the webhook re-registered with it.
//   2. The Vercel API token was echoed into a session transcript by the
//      vercel CLI and should be rotated.
//
// It also says plainly that the "New account request: Deploy Verification
// Probe" email is ours, not a real signup.
//
// Sent from omnios.news, which is a verified Resend domain.

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

const subject = "The bot token is dead, and the dashboard was quietly broken";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Needs You</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">The Telegram token is revoked, and the dashboard was quietly broken.</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Two things need you personally. One is a two-minute fix. The other is worth knowing about, because it changes what the dashboard has been telling you.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">1 · The bot token in Vercel no longer works</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Telegram answers <strong style="color:#fafafa;">401 Unauthorized</strong> for the <code>TELEGRAM_BOT_TOKEN</code> currently in Vercel production, so the bot cannot be reached. That is why it has been dead, and it is not something I can fix from here.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Open <strong style="color:#fafafa;">@BotFather</strong> in Telegram, run <code>/newbot</code> or <code>/token</code> to issue a token, and set it as <code>TELEGRAM_BOT_TOKEN</code> in Vercel for the <code>omni-ai</code> project. Then reply here and I will register the webhook with the right secret and prove the round trip end to end.
  </p>
  <p style="font-size:13px;line-height:1.7;color:#a1a1aa;margin:0 0 8px 0;">
    For the record, the webhook URL is <strong style="color:#e4e4e7;">https://omnileadsagi.com/api/agi/telegram/webhook</strong>, and I changed that route to require a secret token on every delivery. It used to accept a crafted POST from anyone who guessed the URL, and <code>/run</code> from that URL would have triggered real outreach. It now fails closed.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">2 · Please rotate the Vercel API token</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The Vercel CLI printed the API token from <code>local.env</code> into a session log while I was checking the deployment. It is not in the repository and not public, but a token that appears in a log is a token worth replacing. Revoke it in Vercel and put a fresh one in <code>local.env</code>.
  </p>

  <h2 style="font-size:14px;color:#22c55e;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Also worth knowing</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The AGI layer was reading <strong style="color:#fafafa;">RLS-locked tables with the anon key</strong>. Reads came back as an empty array with HTTP 200 instead of an error, and writes quietly did nothing. So the stats, focus, digests, lead scoring, outreach generation, search, the coach and the autopilot were all reporting zeros and empty lists as if those were real answers. None of it errored, which is why nobody caught it.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    It is fixed and live: the whole layer now runs on the service-role key with proper tenancy checks, four dashboard surfaces that were quietly showing nothing now show their data, and the account-request form on <code>/join</code> works again (it had been writing columns that do not exist on the table, so it could never have succeeded). There is a new gate, <code>npm run audit:rls</code>, that fails the build if anything reaches one of those locked tables the wrong way again.
  </p>
  <p style="font-size:13px;line-height:1.7;color:#a1a1aa;margin:0 0 8px 0;">
    One bit of noise to ignore: you will get an email titled <em>New account request: Deploy Verification Probe</em>. That is mine, from testing the join flow against the live database. The row was deleted right after.
  </p>

  <p style="color:#a1a1aa;font-size:12px;line-height:1.7;margin:24px 0 0 0;border-top:1px solid #27272a;padding-top:14px;">
    Everything else shipped on its own. This one is yours.
  </p>
</div></body></html>`;

(async () => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[owner-email] resend ${res.status}:`, JSON.stringify(body).slice(0, 400));
    process.exit(1);
  }
  console.log(`[owner-email] sent ${body.id} to ${TO}`);
})();
