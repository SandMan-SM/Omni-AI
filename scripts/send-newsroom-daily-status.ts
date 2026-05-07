// Daily newsroom status email to Sitani.
// Run with: npx tsx scripts/send-newsroom-daily-status.ts
//
// Reads posts from all 3 Utah newsroom repos, surfaces what shipped
// today + this week, and flags anything that needs attention.
// From: alfred@omnileadsagi.com → To: sitanim8@gmail.com

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import jsYaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const FROM = "Alfred (Omni AI) <alfred@omnileadsagi.com>";
const TO = "sitanim8@gmail.com";

// ── helpers ────────────────────────────────────────────────────────────────

const SITES: Array<{ label: string; slug: string; postsDir: string; domain: string }> = [
  {
    label: "Utah Main Street",
    slug: "mainst",
    postsDir: path.resolve(__dirname, "../../../Utah-Main-Street/.claude/worktrees/hungry-pasteur-8cce0f/posts"),
    domain: "utahmainstreet.com",
  },
  {
    label: "Beehive Biz Pulse",
    slug: "beehive",
    postsDir: path.resolve(__dirname, "../../../Beehive-Biz-Pulse/posts"),
    domain: "beehivebizpulse.com",
  },
  {
    label: "The Wasatch Post",
    slug: "wasatch",
    postsDir: path.resolve(__dirname, "../../../Wasatch-Post/posts"),
    domain: "thewasatchpost.com",
  },
];

function parseFrontmatter(raw: string): Record<string, unknown> {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try {
    return (jsYaml.load(m[1]) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

interface PostSummary {
  slug: string;
  date: string;
  headline: string;
  operators: string[];
  tickerCount: number;
  kicker?: string;
}

function loadPosts(postsDir: string): PostSummary[] {
  if (!fs.existsSync(postsDir)) return [];
  const files = fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  return files.map((f) => {
    const slug = f.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(postsDir, f), "utf8");
    const fm = parseFrontmatter(raw);

    const headline =
      (fm.headline as string) ??
      (fm.lead_headline as string) ??
      slug;

    const features = (fm.features as Array<{ name: string }>) ?? [];
    const ticker = (fm.ticker as unknown[]) ?? [];

    return {
      slug,
      date: (fm.date as string) ?? slug.slice(0, 10),
      headline,
      operators: features.map((o) => o.name),
      tickerCount: ticker.length,
      kicker: fm.kicker as string | undefined,
    };
  });
}

// ISO date string for today
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO date for N days ago
function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── build report ───────────────────────────────────────────────────────────

interface SiteReport {
  label: string;
  domain: string;
  todayPosts: PostSummary[];
  weekPosts: PostSummary[];
  total: number;
}

function buildReport(): SiteReport[] {
  const today = todayIso();
  const weekAgo = isoNDaysAgo(7);

  return SITES.map((site) => {
    const posts = loadPosts(site.postsDir);
    const todayPosts = posts.filter((p) => p.slug.startsWith(today));
    const weekPosts = posts.filter((p) => {
      const d = p.slug.slice(0, 10);
      return d >= weekAgo && d <= today;
    });
    return {
      label: site.label,
      domain: site.domain,
      todayPosts,
      weekPosts,
      total: posts.length,
    };
  });
}

// ── email ─────────────────────────────────────────────────────────────────

function renderSiteSection(r: SiteReport): string {
  const todayItems =
    r.todayPosts.length === 0
      ? `<li style="color:#a1a1aa;">No post scheduled for today.</li>`
      : r.todayPosts
          .map((p) => {
            const ops =
              p.operators.length > 0
                ? `<br><span style="color:#a1a1aa;">Operators: ${p.operators.join(", ")}</span>`
                : p.tickerCount > 0
                ? `<br><span style="color:#a1a1aa;">${p.tickerCount} ticker items</span>`
                : "";
            const kicker = p.kicker ? `<span style="color:#71717a;">[${p.kicker}]</span> ` : "";
            return `<li>${kicker}<strong>${p.headline}</strong> — <code style="font-size:12px;">/posts/${p.slug}</code>${ops}</li>`;
          })
          .join("\n");

  const weekLines =
    r.weekPosts.length === 0
      ? "<li style='color:#a1a1aa;'>No posts this week yet.</li>"
      : r.weekPosts
          .map((p) => {
            const ops = p.operators.length > 0 ? ` (${p.operators.join(", ")})` : p.tickerCount > 0 ? ` (${p.tickerCount} items)` : "";
            return `<li style="color:#d4d4d8;font-size:13px;">${p.slug} — ${p.headline}${ops}</li>`;
          })
          .join("\n");

  return `
  <h2 style="font-size:14px;color:#f59e0b;margin:28px 0 6px;letter-spacing:.08em;text-transform:uppercase;">${r.label} · ${r.domain}</h2>
  <p style="color:#a1a1aa;font-size:12px;margin:0 0 8px 0;">${r.total} total post${r.total !== 1 ? "s" : ""} on file</p>
  <p style="color:#e4e4e7;font-size:13px;font-weight:600;margin:0 0 4px;">Today</p>
  <ul style="font-size:14px;line-height:1.9;color:#e4e4e7;padding-left:18px;margin:0 0 12px 0;">${todayItems}</ul>
  <p style="color:#e4e4e7;font-size:13px;font-weight:600;margin:0 0 4px;">This week</p>
  <ul style="font-size:14px;line-height:1.7;padding-left:18px;margin:0 0 4px;">${weekLines}</ul>`;
}

function buildEmail(report: SiteReport[]): { subject: string; html: string; text: string } {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const totalToday = report.reduce((n, r) => n + r.todayPosts.length, 0);
  const totalWeek = report.reduce((n, r) => n + r.weekPosts.length, 0);

  const subject = `Utah newsrooms · daily status · ${new Date().toISOString().slice(0, 10)}`;

  const siteSections = report.map(renderSiteSection).join("\n");

  const allWeekOps = report.flatMap((r) => r.weekPosts.flatMap((p) => p.operators)).filter(Boolean);
  const uniqueOps = [...new Set(allWeekOps)];

  const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">
  <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:14px;">Omni AI · Utah Newsrooms</div>
  <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:800;color:#fafafa;">Daily Status</h1>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 6px 0;">${today}</p>
  <p style="color:#a1a1aa;font-size:13px;margin:0 0 24px 0;">
    ${totalToday} post${totalToday !== 1 ? "s" : ""} scheduled today &nbsp;·&nbsp; ${totalWeek} post${totalWeek !== 1 ? "s" : ""} this week &nbsp;·&nbsp; ${uniqueOps.length} unique operator${uniqueOps.length !== 1 ? "s" : ""} featured
  </p>

  ${siteSections}

  ${
    uniqueOps.length > 0
      ? `<h2 style="font-size:14px;color:#f59e0b;margin:28px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Operators featured this week</h2>
  <ul style="font-size:14px;line-height:1.8;color:#e4e4e7;padding-left:18px;margin:0 0 20px 0;">
    ${uniqueOps.map((o) => `<li>${o}</li>`).join("\n    ")}
  </ul>`
      : ""
  }

  <h2 style="font-size:14px;color:#f59e0b;margin:28px 0 6px;letter-spacing:.08em;text-transform:uppercase;">Standing flags</h2>
  <ul style="font-size:14px;line-height:1.8;color:#e4e4e7;padding-left:18px;margin:0 0 20px 0;">
    <li>All 3 repos are local-only — no GitHub remote yet. Set up remotes + connect to Vercel for auto-deploy on commit.</li>
    <li>Resend domains (utahmainstreet.com, beehivebizpulse.com, thewasatchpost.com) need DNS verification before cron dispatch sends from custom addresses.</li>
    <li>Cron fires at 14:00 UTC (8 AM MT). Verify Vercel cron is active after first deploy with a remote.</li>
    <li>Utah Main Street is on branch <code>claude/hungry-pasteur-8cce0f</code> — merge to main or set that branch as the Vercel production branch.</li>
  </ul>

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #27272a;color:#71717a;font-size:12px;">
    Auto-generated by <code>scripts/send-newsroom-daily-status.ts</code>. Run again any morning: <code>npx tsx scripts/send-newsroom-daily-status.ts</code>
  </div>
</div>
</body></html>`;

  const lines: string[] = [
    `Utah Newsrooms · Daily Status · ${new Date().toISOString().slice(0, 10)}`,
    `${today}`,
    `${totalToday} post(s) today · ${totalWeek} this week · ${uniqueOps.length} operator(s) featured`,
    "",
  ];

  for (const r of report) {
    lines.push(`── ${r.label} (${r.domain}) ──`);
    lines.push(`Total posts: ${r.total}`);
    lines.push("TODAY:");
    if (r.todayPosts.length === 0) {
      lines.push("  No post scheduled.");
    } else {
      for (const p of r.todayPosts) {
        const ops = p.operators.length > 0 ? ` [${p.operators.join(", ")}]` : p.tickerCount > 0 ? ` [${p.tickerCount} ticker items]` : "";
        lines.push(`  ${p.slug}: ${p.headline}${ops}`);
      }
    }
    lines.push("THIS WEEK:");
    if (r.weekPosts.length === 0) {
      lines.push("  No posts this week yet.");
    } else {
      for (const p of r.weekPosts) {
        const ops = p.operators.length > 0 ? ` [${p.operators.join(", ")}]` : "";
        lines.push(`  ${p.slug}: ${p.headline}${ops}`);
      }
    }
    lines.push("");
  }

  if (uniqueOps.length > 0) {
    lines.push("OPERATORS FEATURED THIS WEEK:");
    uniqueOps.forEach((o) => lines.push(`  - ${o}`));
    lines.push("");
  }

  lines.push("STANDING FLAGS:");
  lines.push("  - No GitHub remotes yet. Connect repos to Vercel for auto-deploy.");
  lines.push("  - Resend domains need DNS verification for custom From addresses.");
  lines.push("  - Cron fires at 14:00 UTC (8 AM MT). Verify after first deploy.");
  lines.push("  - Utah Main Street is on branch claude/hungry-pasteur-8cce0f. Merge to main or set as Vercel prod branch.");

  return { subject, html, text: lines.join("\n") };
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const report = buildReport();
  const { subject, html, text } = buildEmail(report);

  console.log(`Subject: ${subject}`);
  console.log(`Sites: ${report.map((r) => `${r.label} (${r.total} posts)`).join(", ")}`);

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
  console.log("Sent:", (body as { id?: string }).id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
