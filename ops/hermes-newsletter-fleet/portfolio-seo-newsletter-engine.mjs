#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const CLIENTS_ROOT = "/Users/janahasson/Desktop/Clients";
const LOG_ROOT = path.join(CLIENTS_ROOT, "_agent-logs");
const RUN_DATE = new Date();
const DAY = RUN_DATE.toISOString().slice(0, 10);
const STAMP = RUN_DATE.toISOString().replace(/[:.]/g, "-");
const OUT_DIR = path.join(LOG_ROOT, "seo-newsletter-posts", DAY);
const DASH_DIR = path.join(LOG_ROOT, "dashboards");
const DASH_HTML = path.join(DASH_DIR, "omniclaw-seo-newsletter-dashboard.html");
const DASH_JSON = path.join(DASH_DIR, "omniclaw-seo-newsletter-dashboard.json");
const WRITE_SOURCE = process.env.OMNI_SEO_WRITE_SOURCE === "1";
const PORTFOLIO_EXCLUSIONS = [
  "/Mafi Rentals/",
  "/North Peak Roofing/",
];

const SERVICE_OVERRIDES = [
  {
    match: "/CPS/cps-website",
    client: "CPS",
    market: "Utah",
    audience: "parents, attorneys, schools, and referral partners",
    services: ["behavioral health evaluations", "ADHD evaluations", "autism evaluations", "custody evaluations"],
    compliance: "HIPAA-safe, no diagnosis promises, no patient details",
  },
  {
    match: "/Sitani Mafi/Omni AI/Website",
    client: "Omni AI",
    market: "United States",
    audience: "business owners and operators",
    services: ["AI CEO systems", "automation", "lead generation", "CRM operations"],
  },
  {
    match: "/Leifson Built/Website",
    client: "Leifson Built",
    market: "Utah",
    audience: "homeowners planning serious construction projects",
    services: ["custom builds", "remodel planning", "project quoting", "contractor trust"],
  },
  {
    match: "/Prime IV Sandy/Website",
    client: "Prime IV Sandy",
    market: "Sandy Utah",
    audience: "wellness-focused local clients",
    services: ["IV hydration", "energy support", "recovery support", "wellness consultations"],
    compliance: "wellness support only; no cure, treatment, or guaranteed outcome claims",
  },
  {
    match: "/Prime IV Sandy/LBOTD/Website",
    client: "Live Better On The Drip",
    market: "Sandy Utah",
    audience: "wellness listeners and Prime IV Sandy referral leads",
    services: ["wellness routines", "hydration support", "recovery support", "healthy local resources"],
    compliance: "wellness support only; no cure, treatment, or guaranteed outcome claims",
  },
  {
    match: "/Youngs Cabinet Refinishing/Website",
    client: "Youngs Cabinet Refinishing",
    market: "Utah",
    audience: "homeowners comparing kitchen refresh options",
    services: ["cabinet refinishing", "kitchen refresh", "painted cabinets", "project estimates"],
  },
  {
    match: "/Love Thy Barber/Website",
    client: "Love Thy Barber",
    market: "Utah",
    audience: "clients, supporters, and community partners",
    services: ["barbering", "community grooming", "preparation tips", "mission support"],
  },
  {
    match: "/Alira/Website",
    client: "Alira",
    market: "Utah",
    audience: "community members looking for spiritual insight and events",
    services: ["spiritual insights", "events", "retreats", "community stories"],
  },
  {
    match: "/SEO PPC/Website",
    client: "SEO PPC",
    market: "United States",
    audience: "business owners trying to win search demand",
    services: ["SEO", "PPC", "local search", "conversion tracking"],
  },
  {
    match: "/AI Digital Marketing/Website",
    client: "AI Digital Marketing",
    market: "United States",
    audience: "teams upgrading digital marketing with AI",
    services: ["AI marketing", "content systems", "paid media", "automation"],
  },
];

const FALLBACK_TRENDS = [
  "local search intent",
  "AI automation",
  "near me services",
  "customer trust signals",
  "summer planning",
  "small business growth",
  "appointment booking",
  "Google reviews",
  "service pricing",
  "local expert advice",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "seo-newsletter";
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function fetchTrendingKeywords() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://trends.google.com/trending/rss?geo=US", {
      signal: controller.signal,
      headers: { "user-agent": "OmniClaw SEO Newsletter Engine/1.0" },
    });
    if (!response.ok) throw new Error(`Google Trends RSS ${response.status}`);
    const xml = await response.text();
    const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)]
      .map((match) => (match[1] || match[2] || "").replace(/Google Trends.*$/i, "").trim())
      .filter(Boolean)
      .filter((title) => !/daily search trends/i.test(title));
    return [...new Set(titles)].slice(0, 30);
  } catch (error) {
    return FALLBACK_TRENDS.map((keyword) => `${keyword} (fallback: ${error.message})`);
  } finally {
    clearTimeout(timer);
  }
}

function discoverWebsiteRoots() {
  const roots = [];
  const skip = new Set(["node_modules", ".git", ".next", "dist", "build", "out"]);
  function walk(dir, depth = 0) {
    if (depth > 5) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === "package.json")) {
      const rel = dir.replace(CLIENTS_ROOT, "");
      const excluded = PORTFOLIO_EXCLUSIONS.some((segment) => `${rel}/`.includes(segment));
      if (!excluded && !rel.includes("/_tmp/") && !rel.includes("/_agent-worktrees/") && !rel.includes("/omni-memory-mcp")) {
        roots.push(dir);
      }
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || skip.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  }
  walk(CLIENTS_ROOT);
  return [...new Set(roots)].sort();
}

function metadataFor(root) {
  const normalized = root.replace(CLIENTS_ROOT, "");
  const override = SERVICE_OVERRIDES.find((item) => normalized.includes(item.match));
  if (override) return override;
  const parts = normalized.split(path.sep).filter(Boolean);
  const client = titleCase(parts.slice(0, -1).join(" ") || parts[0] || path.basename(root));
  return {
    client,
    market: "local market",
    audience: "current customers and qualified prospects",
    services: ["local expertise", "service education", "customer trust", "booking decisions"],
  };
}

function compatiblePublishDir(root) {
  const candidates = [
    "posts",
    "content/newsletter",
    "content/newsletters",
    "content/blog",
    "src/content/newsletter",
    "src/content/blog",
  ];
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return full;
  }
  return null;
}

function pickKeywords(meta, trends, index) {
  const trend = trends[index % trends.length] || FALLBACK_TRENDS[index % FALLBACK_TRENDS.length];
  const service = meta.services[index % meta.services.length];
  const geo = meta.market;
  return [...new Set([service, geo, trend, `${service} ${geo}`, `${geo} ${service} tips`])];
}

function buildPost(meta, root, keywords, trend) {
  const primary = keywords[0];
  const geo = meta.market;
  const title = `${titleCase(primary)}: What ${meta.client} Is Watching This Week`;
  const description = `${meta.client} explains how ${meta.audience} can use this week's ${geo} search signals to make a smarter next move.`;
  const slug = `${DAY}-${slugify(meta.client)}-${slugify(primary)}`;
  const compliance = meta.compliance ? `\nCompliance note: ${meta.compliance}\n` : "";
  const body = `---
title: "${title.replace(/"/g, "'")}"
slug: "${slug}"
date: "${DAY}"
description: "${description.replace(/"/g, "'")}"
keywords:
${keywords.map((keyword) => `  - "${String(keyword).replace(/"/g, "'")}"`).join("\n")}
source: "OmniClaw SEO Newsletter Engine"
status: "draft-ready"
---

# ${title}

Search demand changes before most customers say anything out loud. This week's trend signal is **${trend.replace(/\s*\(fallback:.*?\)$/i, "")}**, and the useful move is not to chase the trend blindly. The useful move is to translate it into a practical question for ${meta.audience}.

## Local Signal

For ${geo}, the strongest content angle is **${primary}**. People searching around this topic usually want clarity, trust, and a next step they can take without feeling sold to.

## What To Do This Week

- Answer the one question a buyer would ask before booking.
- Mention the local context directly: ${geo}, service area, timing, and common decision points.
- Add a clear CTA that matches the current website: book, call, request an estimate, subscribe, or learn more.
- Reuse this post as a short email intro, one Google Business update, and one social caption.

## Suggested CTA

If this is on your mind, start with the simplest next step on the ${meta.client} website. The right first move is usually a short consultation, estimate request, or newsletter signup.
${compliance}
## Operator Notes

- Website root: ${root}
- Generated: ${RUN_DATE.toISOString()}
- Trend source: Google Trends RSS with local fallback keywords
- Keywords: ${keywords.join(", ")}
`;
  return { title, description, slug, body };
}

function writeSiteOutbox(meta, post) {
  const dir = path.join(OUT_DIR, "website-outbox", slugify(meta.client));
  ensureDir(dir);
  const file = path.join(dir, `${post.slug}.md`);
  fs.writeFileSync(file, post.body);
  return file;
}

function writeDashboard(results, trends) {
  ensureDir(DASH_DIR);
  const totals = {
    websites: results.length,
    sourcePosts: results.filter((row) => row.sourcePostPath).length,
    outboxPosts: results.length,
    trendCount: trends.length,
  };
  const json = { generatedAt: RUN_DATE.toISOString(), totals, trends, results };
  fs.writeFileSync(DASH_JSON, JSON.stringify(json, null, 2));
  const rows = results.map((row) => `
      <tr>
        <td>${escapeHtml(row.client)}</td>
        <td>${escapeHtml(row.market)}</td>
        <td>${escapeHtml(row.primaryKeyword)}</td>
        <td>${row.sourcePostPath ? "source + outbox" : "outbox"}</td>
        <td><code>${escapeHtml(row.relativeRoot)}</code></td>
      </tr>`).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OmniClaw SEO Newsletter Dashboard</title>
  <style>
    :root { color-scheme: light; --ink:#172033; --muted:#647084; --line:#d9e2ef; --brand:#0f766e; --soft:#edfdfa; --gold:#b88a2d; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:#f7fafc; }
    header { padding:34px 42px 20px; background:linear-gradient(135deg,#ffffff 0%,#edfdfa 100%); border-bottom:1px solid var(--line); }
    h1 { margin:0 0 10px; font-size:34px; letter-spacing:0; }
    p { color:var(--muted); line-height:1.55; }
    main { padding:28px 42px 48px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(150px,1fr)); gap:14px; margin:22px 0; }
    .card { background:white; border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 10px 24px rgba(23,32,51,.05); }
    .label { color:var(--muted); font-size:12px; text-transform:uppercase; font-weight:800; letter-spacing:.12em; }
    .value { font-size:30px; font-weight:850; margin-top:6px; }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); border-radius:8px; overflow:hidden; box-shadow:0 10px 24px rgba(23,32,51,.05); }
    th,td { padding:14px 16px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { background:#f1f5f9; font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:#475569; }
    code { font-size:12px; color:#334155; }
    .trends { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 26px; }
    .trend { padding:7px 10px; border:1px solid #99f6e4; border-radius:999px; background:var(--soft); color:#115e59; font-weight:700; font-size:13px; }
    @media (max-width: 860px) { header, main { padding-left:20px; padding-right:20px; } .cards { grid-template-columns:1fr 1fr; } table { font-size:13px; } }
  </style>
</head>
<body>
  <header>
    <div class="label">Omni OS Growth Engine</div>
    <h1>SEO Newsletter Publishing Dashboard</h1>
    <p>Generated ${RUN_DATE.toLocaleString("en-US", { timeZone: "America/Denver" })}. Each website received a central publish-queue post. Direct source writes are ${WRITE_SOURCE ? "enabled for this run" : "off by default to prevent dirty worktrees"}.</p>
  </header>
  <main>
    <section class="cards">
      <div class="card"><div class="label">Websites</div><div class="value">${totals.websites}</div></div>
      <div class="card"><div class="label">Direct Source Posts</div><div class="value">${totals.sourcePosts}</div></div>
      <div class="card"><div class="label">Outbox Posts</div><div class="value">${totals.outboxPosts}</div></div>
      <div class="card"><div class="label">Trend Keywords</div><div class="value">${totals.trendCount}</div></div>
    </section>
    <h2>Trending Keyword Inputs</h2>
    <div class="trends">${trends.slice(0, 18).map((trend) => `<span class="trend">${escapeHtml(trend.replace(/\s*\(fallback:.*?\)$/i, ""))}</span>`).join("")}</div>
    <h2>Website Publishing Status</h2>
    <table>
      <thead><tr><th>Client</th><th>Market</th><th>Primary Keyword</th><th>Status</th><th>Root</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
  fs.writeFileSync(DASH_HTML, html);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

async function main() {
  ensureDir(OUT_DIR);
  const trends = await fetchTrendingKeywords();
  const roots = discoverWebsiteRoots();
  const results = [];
  roots.forEach((root, index) => {
    const meta = metadataFor(root);
    const keywords = pickKeywords(meta, trends, index);
    const trend = trends[index % trends.length] || keywords[0];
    const post = buildPost(meta, root, keywords, trend);
    const publishDir = compatiblePublishDir(root);
    let sourcePostPath = null;
    if (publishDir && WRITE_SOURCE) {
      sourcePostPath = path.join(publishDir, `${post.slug}.md`);
      fs.writeFileSync(sourcePostPath, post.body);
    }
    const outboxPath = writeSiteOutbox(meta, post);
    const artifactPath = path.join(OUT_DIR, `${post.slug}.md`);
    fs.writeFileSync(artifactPath, post.body);
    results.push({
      client: meta.client,
      market: meta.market,
      websiteRoot: root,
      relativeRoot: root.replace(`${CLIENTS_ROOT}/`, ""),
      primaryKeyword: keywords[0],
      keywords,
      sourcePostPath,
      outboxPath,
      artifactPath,
      title: post.title,
    });
  });
  writeDashboard(results, trends);
  console.log("SEO_NEWSLETTER_ENGINE_OK TRUE");
  console.log(`GENERATED_AT ${RUN_DATE.toISOString()}`);
  console.log(`WEBSITES_PROCESSED ${results.length}`);
  console.log(`DIRECT_SOURCE_POSTS ${results.filter((row) => row.sourcePostPath).length}`);
  console.log(`OUTBOX_POSTS ${results.length}`);
  console.log(`DASHBOARD_HTML ${DASH_HTML}`);
  console.log(`DASHBOARD_JSON ${DASH_JSON}`);
}

main().catch((error) => {
  console.error("SEO_NEWSLETTER_ENGINE_OK FALSE");
  console.error(`SEO_NEWSLETTER_ENGINE_ERROR ${error.stack || error.message}`);
  process.exit(1);
});
