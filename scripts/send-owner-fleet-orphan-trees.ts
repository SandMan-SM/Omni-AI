// One-off: the owner-action email for session 58.
//
// One item needs him personally, and it is a DECISION rather than a fix:
//
//   Four folders on this machine hold older copies of this site whose git
//   link is broken — `git` will not operate in them at all — and all four
//   still point at the PRODUCTION Vercel project. A `vercel --prod` from
//   any of them would publish an old, unreviewed tree and delete about 59
//   live routes from omnileadsagi.com. The only fixes available are
//   retire / re-sync / re-init, and each one disposes of work only he can
//   judge.
//
// The email also records the leak the new privacy gate found in those same
// four folders (`GET /api/newsletter` returning every subscriber's email
// to an anonymous caller), because it is fixed but it is the kind of thing
// worth being told about rather than assumed.
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

const subject = "Four old copies of the site are one deploy away from overwriting production";

const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Needs You</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;line-height:1.2;">Four old copies of the site are one deploy away from overwriting production.</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
    Nothing is broken right now. This is a decision that is yours to make, before somebody (including me) runs the wrong command in the wrong folder.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">The four folders</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    They each hold an older copy of this site, and they each still carry a <code>.vercel</code> link pointing at <strong style="color:#fafafa;">the production Vercel project</strong> — the one that serves omnileadsagi.com:
  </p>
  <p style="font-size:13px;line-height:1.8;color:#a1a1aa;margin:0 0 12px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
    Sitani Mafi/Omni AI/.deploy-worktrees/login-fix<br>
    Sitani Mafi/Omni AI/_deploy-worktrees/dashboard-fix<br>
    _tmp/omni-newsletter-fix<br>
    _tmp/omni-premium-newsletter-fix
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Each one is about <strong style="color:#fafafa;">59 route files behind</strong> the live site (193 against 252), and each holds work no other copy has. A single <code>vercel --prod</code> from any of them would publish that older tree and quietly delete around 59 live routes from production — which is exactly what happened on 2026-10-29, when three un-pushed commits ran production for a day.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Why I did not just clean them up</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Their git link is broken. Each one points at <code>…/Clients/Omni AI/Omni AI Website/.git/worktrees/…</code>, and that folder is gone — the repository moved to <code>Sitani Mafi/Omni AI/Website</code> and the worktree bookkeeping went with it. So <code>git</code> refuses to operate in all four: their history, their branch and their staging state are unreachable, and nothing in them can be committed, reviewed or rolled back.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    That is why they are worth knowing about: a folder that no git command can reach is a folder no review process will ever reach. I did patch them and I did not delete them, because deleting a tree that holds work only you can judge is not my call.
  </p>

  <h2 style="font-size:14px;color:#f59e0b;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">What I need from you</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    Pick one, and I will do it:
  </p>
  <p style="font-size:14px;line-height:1.8;color:#e4e4e7;margin:0 0 12px 0;">
    <strong style="color:#fafafa;">Retire them.</strong> Delete the four folders. Nothing unique is lost that the live site does not already have, except the newsletter artwork tweaks in the two <code>_tmp</code> copies — which are worth a look first.<br><br>
    <strong style="color:#fafafa;">Re-sync them.</strong> Bring each one up to the live tree and give it a real git history, so it can be reviewed and committed like any other copy.<br><br>
    <strong style="color:#fafafa;">Re-init them.</strong> Start each one as a fresh repository on top of the current tree, so it is at least versioned and no longer a silent deploy hazard.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    If you would rather I simply make them safe without disposing of anything, the other option is to remove the production <code>.vercel</code> link from each — after which no deploy can be launched from them by accident. Say the word and I will do that instead.
  </p>

  <h2 style="font-size:14px;color:#22c55e;margin:24px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Also worth knowing</h2>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    The new privacy gate found a leak in those same four folders. <code>GET /api/newsletter</code> was answering anyone who asked it — no sign-in, no key — with <strong style="color:#fafafa;">the entire subscriber list</strong>, every reader's email in one response. The live site had closed that route a long time ago; those copies had not. All four are patched, and each one now reports clean under the gate.
  </p>
  <p style="font-size:14px;line-height:1.7;color:#e4e4e7;margin:0 0 8px 0;">
    That is the second time this week a leak turned up in a copy rather than in the live site, which is the argument for the gate existing at all: the live surface is not the whole surface. Separately, the live leaderboard no longer publishes any owner's real name, and the live subscriber route answers <code>401</code> to an anonymous caller.
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
