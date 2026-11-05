#!/usr/bin/env node
// Live mobile audit — a real browser at a real 375px viewport.
//
// The static gate (`scripts/audit-mobile-ui.ts`) can only see what the
// source says. It cannot see a `grid` that overflows after hydration, an
// image whose CDN returns 404, a client component that throws on mount, or
// a decorative glow that pushes the document wider than the viewport. Those
// are the defects a phone actually finds, and none of them reach `tsc` or
// `next build`.
//
// This drives the Chrome DevTools Protocol directly over Node's global
// WebSocket (Node 18+; this repo runs Node 24). No new dependency, no
// Puppeteer/Playwright install, no repo churn — it reuses the chromium
// binary Playwright already cached on this machine.
//
//   node scripts/audit-live-mobile.mjs                     # audit prod routes
//   node scripts/audit-live-mobile.mjs --base=http://localhost:3001
//   node scripts/audit-live-mobile.mjs --all               # every sitemap URL
//   node scripts/audit-live-mobile.mjs --only=/newsletter
//
// Rules (RULE_NAMES):
//   horizontal-overflow  the document is wider than the viewport — the
//                        classic 375px sideways-scroll defect
//   broken-image        an <img> that finished loading with zero natural
//                        width (404, blocked, or a bad src)
//   image-missing-alt   an <img> with no alt attribute
//   dead-href           an <a href="#"> that goes nowhere
//   console-error       an uncaught exception or console.error on the page
//   resource-error      a same-origin subresource answered 4xx/5xx
//                        (a 429 is NOT one of them — see the note at the
//                        responseReceived handler)
//   soft-404            a page that says "not found" but answered HTTP 200,
//                        OR a probe path that cannot exist and answered
//                        anything other than 404. Next.js serves its
//                        not-found UI with a 200 when a loading.tsx boundary
//                        streams the shell before the page component throws,
//                        so the break is invisible to a status check but very
//                        visible to a crawler.
//   sitemap-dead-url     a URL the sitemap advertises that did not answer
//                        HTTP 200 — a dead entry in the discovery manifest
//   sitemap-noindex      a URL the sitemap advertises whose own page says
//                        "noindex" — the manifest and the page disagree
//
// Read-only against the target site. Exits non-zero when anything fires,
// so it works as a pre-ship gate. The target host is never authenticated
// against, and nothing is written anywhere.

import { readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const RULE_NAMES = [
  'horizontal-overflow',
  'broken-image',
  'image-missing-alt',
  'dead-href',
  'console-error',
  'resource-error',
  'soft-404',
  'light-canvas',
  'light-surface',
  'sitemap-dead-url',
  'sitemap-noindex',
];

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  // Accept both `--name value` and `--name=value`. The `=` form is the one
  // people actually type, and silently falling back to the default host on
  // a typo'd flag is how you end up auditing production by accident.
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = arg('--base', 'https://omnileadsagi.com').replace(/\/+$/, '');
const ALL = argv.includes('--all');
const ONLY = arg('--only', '');
const VIEWPORT_W = 375;
const VIEWPORT_H = 812;
const SETTLE_MS = 1500;
const PER_PAGE_TIMEOUT_MS = 20000;

// ── Locate a chromium binary ────────────────────────────────────────────────
function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const roots = [
    join(homedir(), 'Library/Caches/ms-playwright'),
    join(homedir(), '.cache/ms-playwright'),
  ];
  const candidates = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      if (!/chromium/.test(dir)) continue;
      for (const rel of [
        'chrome-headless-shell-mac-arm64/chrome-headless-shell',
        'chrome-headless-shell-mac-x64/chrome-headless-shell',
        'chrome-headless-shell-linux64/chrome-headless-shell',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
      ]) {
        const p = join(root, dir, rel);
        if (existsSync(p)) candidates.push({ p, mtime: statSync(p).mtimeMs });
      }
    }
  }
  if (!candidates.length) {
    throw new Error(
      'No chromium binary found. Set CHROME_PATH to a chrome/chrome-headless-shell binary.',
    );
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].p;
}

// ── Minimal CDP client over the global WebSocket ───────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params, msg.sessionId);
      }
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, PER_PAGE_TIMEOUT_MS);
    });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new CDP(ws)));
    ws.addEventListener('error', (e) => reject(new Error(`websocket error: ${e?.message || 'failed'}`)));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The in-page audit, run once the page has settled ───────────────────────
// Returns plain data so it survives the CDP JSON round-trip.
const PAGE_AUDIT = `(() => {
  const vw = window.innerWidth;
  const nav = performance.getEntriesByType('navigation')[0];
  const status = nav ? nav.responseStatus : 0;
  const h1 = document.querySelector('h1');
  const out = { width: vw, scrollWidth: document.documentElement.scrollWidth, title: document.title, h1: h1 ? (h1.textContent || '').trim().slice(0, 80) : '', status, bodyLen: document.body ? document.body.innerText.length : 0, links: document.querySelectorAll('a[href]').length, imgs: document.images.length, overflow: [], brokenImages: [], missingAlt: [], deadHrefs: [] };

  // The page's own indexability directives. A sitemap URL whose page says
  // "noindex" is a contradiction the sitemap alone cannot show.
  const robotsMeta = document.querySelector('meta[name="robots"]');
  const googleBotMeta = document.querySelector('meta[name="googlebot"]');
  out.robots = robotsMeta ? (robotsMeta.getAttribute('content') || '') : '';
  out.googleBot = googleBotMeta ? (googleBotMeta.getAttribute('content') || '') : '';

  const desc = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (typeof el.className === 'string' && el.className.trim())
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
      : '';
    const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    return el.tagName.toLowerCase() + id + cls + (text ? ' :: "' + text + '"' : '');
  };

  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  };

  const offenders = [];
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (clipped(el)) continue;
    offenders.push({ el, r });
  }
  // Report only the deepest offenders — a wide parent is not the cause when
  // a child inside it is.
  const leaves = offenders.filter(({ el }) => !offenders.some((o) => o.el !== el && el.contains(o.el)));
  for (const { el, r } of leaves.slice(0, 5)) {
    out.overflow.push({
      desc: desc(el),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
    });
  }
  if (!leaves.length && out.scrollWidth > vw + 1) {
    out.overflow.push({ desc: '(document is wider than the viewport but every overflowing element is clipped)', left: 0, right: out.scrollWidth, width: out.scrollWidth });
  }

  for (const img of document.images) {
    const src = img.currentSrc || img.src || '';
    if (src && img.complete && img.naturalWidth === 0) {
      out.brokenImages.push({ src: src.slice(0, 160), alt: img.getAttribute('alt') });
    }
    if (!img.hasAttribute('alt')) out.missingAlt.push({ src: src.slice(0, 160) });
  }

  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (h === '#' || h === '' || h === 'javascript:void(0)') {
      out.deadHrefs.push({ text: (a.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60), href: h });
    }
  }

  // ── Dark theme ────────────────────────────────────────────────────────────
  // The visible canvas on a dark site is the HTML element's background, not
  // the body's: the body is transparent by default and the UA paints the
  // canvas with the html background whenever it is. A body-only probe reads
  // rgba(0,0,0,0) forever and looks like a healthy no-op.
  const parse = (value) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(value || '');
    if (!m) return null;
    const parts = m[1].split(',').map((n) => parseFloat(n));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  // Relative luminance proxy: the perceptual weights, on 0-255 channels.
  const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const htmlBg = parse(getComputedStyle(document.documentElement).backgroundColor);
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
  const canvas = bodyBg && bodyBg.a > 0.05 ? bodyBg : htmlBg;
  out.canvas = canvas ? 'rgb(' + Math.round(canvas.r) + ',' + Math.round(canvas.g) + ',' + Math.round(canvas.b) + ')' : 'none';
  out.canvasLuma = canvas ? Math.round(luma(canvas)) : null;

  // A large light surface on a dark site is the classic theme break: one
  // section, card or embed rendered with the light palette. Only surfaces
  // that cover a meaningful share of the viewport count — a white CTA button
  // is an intentional inversion, not a broken theme.
  const viewportArea = vw * window.innerHeight;
  const lightSurfaces = [];
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const bg = parse(cs.backgroundColor);
    if (!bg) continue;
    // A surface's own alpha is only half its effective opacity: the CSS
    // opacity property multiplies the whole element. A decorative glow
    // painted #ffd700 at 18% opacity is a warm brown smear on a near-black
    // canvas, not a light surface — scoring it on the raw background colour
    // reported it as a theme break.
    const opacity = cs.opacity === "" ? 1 : parseFloat(cs.opacity);
    const alpha = bg.a * (Number.isNaN(opacity) ? 1 : opacity);
    if (alpha < 0.6) continue;
    // Composite over the canvas before judging lightness: what the eye sees
    // is the blend, not the paint.
    const over = canvas
      ? {
          r: bg.r * alpha + canvas.r * (1 - alpha),
          g: bg.g * alpha + canvas.g * (1 - alpha),
          b: bg.b * alpha + canvas.b * (1 - alpha),
        }
      : { r: bg.r, g: bg.g, b: bg.b };
    if (luma(over) < 170) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width * r.height < viewportArea * 0.2) continue;
    lightSurfaces.push({ desc: desc(el), area: Math.round((r.width * r.height / viewportArea) * 100), bg: cs.backgroundColor });
    if (lightSurfaces.length >= 3) break;
  }
  out.lightSurfaces = lightSurfaces;
  return out;
})()`;

// ── Route discovery ─────────────────────────────────────────────────────────
async function sitemapPaths() {
  try {
    const res = await fetch(`${BASE}/sitemap.xml`);
    if (!res.ok) return [];
    const xml = await res.text();
    // Map every <loc> to its path. The sitemap always advertises the
    // canonical production host, so filtering on BASE would drop every
    // URL the moment the audit runs against localhost.
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return u;
        }
      })
      .filter((p) => p.startsWith('/'));
  } catch {
    return [];
  }
}

// Reduce 468 sitemap URLs to a representative set of route shapes: the
// newsletter archive alone is 300+ slugs and they all render the same
// template.
function routeShapes(paths) {
  const byShape = new Map();
  for (const p of paths) {
    const segs = p.split('/').filter(Boolean);
    const shape = '/' + segs.map((s, i) => (i === segs.length - 1 && /[0-9a-f]{8,}|\d{4}/.test(s) ? ':id' : s)).join('/');
    if (!byShape.has(shape)) byShape.set(shape, p);
  }
  return [...byShape.values()];
}

const EXTRA_PATHS = [
  '/', '/login', '/newsletter', '/newsletter/archive', '/newsletter/premium',
  '/cps/marketing', '/command', '/portfolio', '/search?q=ai',
  '/p/omnileads/federation-pilot', '/p/rene/rene-sacred-letter-test',
  '/llms.txt', '/robots.txt',
  // A real booking link. `/book/[business]` is keyed by the business's
  // uuid, so without this the gate never sees the live widget at all.
  '/book/6ddda3b5-c51b-4965-822a-88d692fc2544',
];

// Paths that MUST answer HTTP 404. One per dynamic route family that calls
// notFound(). The sitemap can only prove that real URLs resolve — it can
// never prove that a bogus one does not, and a route that answers 200 for a
// slug that does not exist is exactly the soft-404 this gate exists to
// catch. Add a probe here whenever a new dynamic route starts calling
// notFound().
const NOT_FOUND_PROBES = [
  '/zzzz-not-a-real-page',
  '/newsletter/zzzz-not-a-real-issue',
  '/p/omnileads/zzzz-not-a-real-page',
  '/lp/zzzz-not-a-real-page',
  '/partners/zzzz-not-a-real-page',
  '/vs/zzzz-not-a-real-page',
  '/federation/case-studies/zzzz-not-a-real-page',
  '/referral/renelaveau/ZZZZNOTACODE',
  '/alira/referral/ZZZZNOTACODE',
  '/book/00000000-0000-0000-0000-000000000000',
];

// ── Main ────────────────────────────────────────────────────────────────────
const chromePath = findChromium();
const port = 9500 + Math.floor(Math.random() * 400);
// The profile directory is per-run, not per-port. Chrome persists its HTTP
// cache in the profile, so a reused directory can replay a chunk URL from a
// previous build and report it as a 404 on a page that never referenced it —
// a phantom finding that sends you chasing a bug that does not exist.
const profile = `/tmp/omni-live-audit-${port}-${process.pid}`;
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--headless',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--hide-scrollbars',
], { stdio: 'ignore' });

const cleanup = () => {
  try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

let version = null;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (res.ok) { version = await res.json(); break; }
  } catch { /* not up yet */ }
  await sleep(250);
}
if (!version) {
  cleanup();
  throw new Error(`Chromium did not open a debugging port on ${port}`);
}

const cdp = await connect(version.webSocketDebuggerUrl);

const allPaths = await sitemapPaths();
let paths;
if (ONLY) {
  paths = [ONLY];
} else if (ALL) {
  paths = [...new Set([...EXTRA_PATHS, ...NOT_FOUND_PROBES, ...allPaths])];
} else {
  paths = [...new Set([...EXTRA_PATHS, ...NOT_FOUND_PROBES, ...routeShapes(allPaths)])];
}

// The routes the sitemap itself advertises. Everything else in `paths` is
// either a hand-picked extra or a 404 probe. This set is what the sitemap
// rules below judge.
const sitemapSet = new Set(allPaths);

/**
 * The prefixes the site declares INTERNAL, read from its own robots.txt.
 *
 * Used for exactly one judgement: a 401 on a subresource of an
 * INTERNAL page is the page's admin gate working, not a broken
 * resource. An internal dashboard fetches its data from a
 * `requireAdmin()` route, and this auditor is anonymous by
 * construction — so the 401 is the correct answer, and reporting it
 * as `resource-error` teaches the operator to ignore the rule.
 *
 * The judgement is deliberately narrow: a 401 on a PUBLIC page's
 * subresource is still a finding, because a public page has no
 * business calling an admin API. Only the internal page's own data
 * fetch is excused.
 *
 * Derived, not hardcoded, so "internal" has one definition — the
 * site's own — and the same idea holds on any site this runs against.
 */
const internalPrefixes = await (async () => {
  try {
    const res = await fetch(`${BASE}/robots.txt`);
    if (!res.ok) return [];
    const text = await res.text();
    const out = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*disallow\s*:\s*(\S+)\s*$/i);
      if (!m) continue;
      const p = m[1].trim();
      if (!p || p === '/') continue;
      out.push(p.replace(/\/+$/, ''));
    }
    return out;
  } catch {
    return [];
  }
})();

function isInternalPath(p) {
  return internalPrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

console.log(`auditing ${paths.length} route(s) at ${VIEWPORT_W}px against ${BASE}`);

const findings = [];
const summary = [];
/**
 * Subresources the site REFUSED to serve because this audit asked too
 * often. Not findings — see the `responseReceived` handler — but they are
 * reported, because "the sweep tripped the site's own rate limiter" is
 * something the operator should know: it means the audit is not measuring
 * the site the way a reader experiences it.
 */
const rateLimitedHits = [];
/**
 * Subresources an INTERNAL page asked for and was correctly refused.
 * Observations, not findings — the admin gate working.
 */
const authGatedHits = [];

async function auditPath(p) {
  const url = `${BASE}${p}`;
  let targetId;
  try {
    ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }));
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    const consoleErrors = [];
    const resourceErrors = [];
    const rateLimited = [];

    cdp.on('Runtime.exceptionThrown', (params, sid) => {
      if (sid !== sessionId) return;
      const d = params.exceptionDetails || {};
      const text = d.exception?.description || d.text || 'uncaught exception';
      consoleErrors.push(text.split('\n')[0].slice(0, 200));
    });
    cdp.on('Runtime.consoleAPICalled', (params, sid) => {
      if (sid !== sessionId) return;
      if (params.type !== 'error') return;
      const text = (params.args || [])
        .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
        .join(' ')
        .slice(0, 600);
      consoleErrors.push(text);
    });
    cdp.on('Log.entryAdded', (params, sid) => {
      if (sid !== sessionId) return;
      if (params.entry?.level !== 'error') return;
      // "Failed to load resource" is the browser's generic network-failure
      // line. It fires for the DOCUMENT itself when the route correctly
      // answers 404, and for any 4xx subresource — both of which are
      // reported properly by the soft-404 and resource-error rules (the
      // latter with the offending URL). Counting it here flagged every
      // correct 404 page as a console error.
      if (/Failed to load resource/i.test(params.entry.text || '')) return;
      consoleErrors.push(`${params.entry.source}: ${params.entry.text}`.slice(0, 200));
    });
    cdp.on('Network.responseReceived', (params, sid) => {
      if (sid !== sessionId) return;
      const { status, url: resUrl } = params.response || {};
      if (!status || status < 400) return;
      if (!resUrl || !resUrl.startsWith(BASE)) return;
      if (resUrl === url) return; // the page's own status is not a subresource
      // A 429 is the endpoint WORKING, not a broken resource: it is a rate
      // limiter refusing a client that asks too often. This audit is that
      // client by construction — it drives every route in sequence, each
      // one firing the page's own analytics beacon, from one IP, faster
      // than any human browses. `/api/events/track` allows 120 requests a
      // minute per IP, so a full sweep crosses that line and the beacon
      // starts answering 429 on the later routes.
      //
      // Reporting those 429s as `resource-error` was a false positive: 22
      // findings on a site with no broken subresource, which is exactly the
      // shape of a gate that cries wolf until nobody reads it. So a 429 is
      // counted and reported as an observation — the limiter is doing its
      // job and the operator should know the sweep tripped it — but it is
      // NOT a finding.
      if (status === 429) {
        rateLimited.push(`${resUrl.slice(BASE.length) || '/'}`);
        rateLimitedHits.push(`${p} → ${resUrl.slice(BASE.length) || '/'}`);
        return;
      }
      // A 401/403 on an INTERNAL page's own data fetch is the admin gate
      // answering correctly: this auditor carries no credential, and the
      // page asked for privileged data. Not a broken resource — an
      // expected refusal. On a PUBLIC page the same status is still a
      // finding, because a public page has no business calling an admin
      // API.
      if ((status === 401 || status === 403) && isInternalPath(p)) {
        authGatedHits.push(`${p} → ${resUrl.slice(BASE.length) || '/'}`);
        return;
      }
      resourceErrors.push(`${status} ${resUrl.slice(BASE.length) || '/'}`);
    });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 2, mobile: true,
    }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);

    await cdp.send('Page.navigate', { url }, sessionId);
    await sleep(SETTLE_MS);

    const { result } = await cdp.send('Runtime.evaluate', {
      expression: PAGE_AUDIT, returnByValue: true, awaitPromise: false,
    }, sessionId);
    const page = result?.value || {};

    for (const o of page.overflow || []) {
      findings.push({ rule: 'horizontal-overflow', path: p, detail: `${o.desc} — spans ${o.left}→${o.right}px in a ${VIEWPORT_W}px viewport (document ${page.scrollWidth}px)` });
    }
    for (const b of page.brokenImages || []) {
      findings.push({ rule: 'broken-image', path: p, detail: `image failed to load: ${b.src}` });
    }
    for (const b of page.missingAlt || []) {
      findings.push({ rule: 'image-missing-alt', path: p, detail: `no alt attribute: ${b.src}` });
    }
    for (const h of page.deadHrefs || []) {
      findings.push({ rule: 'dead-href', path: p, detail: `href="${h.href}" on "${h.text}"` });
    }
    for (const e of consoleErrors) {
      findings.push({ rule: 'console-error', path: p, detail: e });
    }
    for (const e of resourceErrors) {
      findings.push({ rule: 'resource-error', path: p, detail: e });
    }
    // A page that renders "not found" but answered 200 is a soft 404. The
    // status is read from the navigation entry, not from a fetch, so it is
    // the status the browser actually received for the document.
    const softMarker = /\b(not found|404|nothing here|doesn'?t exist|page you'?re looking for|issue not found)\b/i;
    if (page.status === 200 && (softMarker.test(page.title || '') || softMarker.test(page.h1 || ''))) {
      findings.push({ rule: 'soft-404', path: p, detail: `answered HTTP 200 but the page reads as a not-found page — title "${page.title}", h1 "${page.h1}"` });
    }
    // A probe path is one that cannot exist. Anything other than 404 means the
    // route rendered something for it — the soft-404 failure mode.
    if (NOT_FOUND_PROBES.includes(p) && page.status !== 404) {
      findings.push({ rule: 'soft-404', path: p, detail: `expected HTTP 404 but the route answered HTTP ${page.status} — this URL does not exist and should not resolve` });
    }
    // The sitemap advertises URLs to crawlers. An advertised URL that does
    // not resolve is a dead entry in the discovery manifest, and nothing
    // else in this gate would say so: the route simply fails to load.
    if (sitemapSet.has(p) && page.status !== 200) {
      findings.push({ rule: 'sitemap-dead-url', path: p, detail: `the sitemap advertises this URL but it answered HTTP ${page.status} — a crawler that follows the manifest is sent to a page that does not exist` });
    }
    // A sitemap URL whose own page says "noindex" is a contradiction: the
    // manifest says index this, the page says do not. The page wins, so the
    // entry never enters the index and the manifest is advertising a URL it
    // has just been told to hide.
    const robotsText = [page.robots, page.googleBot].filter(Boolean).join(' / ');
    if (sitemapSet.has(p) && /noindex/i.test(robotsText)) {
      findings.push({ rule: 'sitemap-noindex', path: p, detail: `the sitemap advertises this URL but the page renders robots "${robotsText}" — the manifest and the page disagree about whether it should be indexed` });
    }
    // Dark theme: the canvas must stay dark on every public page. The site
    // is a near-black design; a page that paints a light canvas is a theme
    // break that no other rule can see — the markup is valid, the images
    // load, and the page is technically "fine".
    if (page.canvasLuma !== null && page.canvasLuma > 60) {
      findings.push({ rule: 'light-canvas', path: p, detail: `the page canvas is ${page.canvas} (luminance ${page.canvasLuma}) — this site is a dark theme and the canvas should be near-black` });
    }
    for (const s of page.lightSurfaces || []) {
      findings.push({ rule: 'light-surface', path: p, detail: `a light surface covers ${s.area}% of the viewport — ${s.desc} (${s.bg})` });
    }

    summary.push({ path: p, scrollWidth: page.scrollWidth, count: findings.filter((f) => f.path === p).length });
    if (argv.includes('--debug')) {
      console.log(`   ${p} — status=${page.status} scrollWidth=${page.scrollWidth} vw=${page.width} imgs=${page.imgs} links=${page.links} text=${page.bodyLen} canvas=${page.canvas} luma=${page.canvasLuma} lightSurfaces=${(page.lightSurfaces || []).length} title="${(page.title || '').slice(0, 50)}" errs=${consoleErrors.length} res=${resourceErrors.length}`);
    }
  } catch (e) {
    findings.push({ rule: 'console-error', path: p, detail: `audit failed: ${e.message}` });
  } finally {
    if (targetId) {
      try { await cdp.send('Target.closeTarget', { targetId }); } catch { /* already closed */ }
    }
  }
}

// Run several pages at once — 468 sitemap URLs at one tab at a time is
// twenty minutes of waiting for nothing.
const CONCURRENCY = Math.max(1, parseInt(arg('--concurrency', '5'), 10) || 5);
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, paths.length) }, async () => {
    while (cursor < paths.length) {
      const p = paths[cursor++];
      await auditPath(p);
    }
  }),
);

cleanup();

// A sitemap URL that answered 404 once is not yet a dead URL.
//
// The routes this gate audits read from the database behind a short
// timeout, and a timeout that is mistaken for "the row is absent" serves a
// 404 for a published issue. That happened to five newsletter issues on
// 2026-11-04: the sweep drove 197 routes in a row, the reads ran past
// their budget, and the manifest URLs 404'd — and every one of them
// answered HTTP 200 when asked again a minute later.
//
// So a candidate is re-fetched before it is called dead. A URL that 404s
// twice is a real dead entry; a URL that answers on the retry was a
// transient, and reporting it would send the reader to fix a page that is
// fine.
const deadCandidates = findings.filter((f) => f.rule === 'sitemap-dead-url');
if (deadCandidates.length) {
  const survivors = [];
  for (const c of deadCandidates) {
    let retryStatus = 0;
    try {
      const r = await fetch(`${BASE}${c.path}`, {
        headers: { 'User-Agent': 'omni-live-audit-retry' },
        signal: AbortSignal.timeout(15000),
      });
      retryStatus = r.status;
    } catch {
      retryStatus = 0;
    }
    if (retryStatus === 200) {
      console.log(
        `note: ${c.path} answered HTTP 404 during the sweep but HTTP 200 on a retry — ` +
          'a transient, not a dead sitemap entry, so it is not a finding.',
      );
      continue;
    }
    survivors.push({
      ...c,
      detail: `${c.detail} (a retry answered HTTP ${retryStatus || 'no response'})`,
    });
  }
  const kept = findings.filter((f) => f.rule !== 'sitemap-dead-url');
  findings.length = 0;
  findings.push(...kept, ...survivors);
}

const byRule = {};
for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;

console.log('');
if (rateLimitedHits.length) {
  console.log(
    `note: ${rateLimitedHits.length} subresource request(s) were refused with HTTP 429 — the site ` +
      "rate-limited this sweep. That is the limiter working, not a broken resource, so it is not a " +
      "finding; it does mean the audit drove the site harder than a reader does.",
  );
  console.log('');
}
if (authGatedHits.length) {
  console.log(
    `note: ${authGatedHits.length} subresource request(s) on internal route(s) were refused ` +
      "with HTTP 401/403 — the admin gate working. This audit carries no credential, so an " +
      "internal page's privileged data fetch is expected to be refused; it is not a finding.",
  );
  console.log('');
}
if (!findings.length) {
  console.log(`scanned ${paths.length} live route(s) at ${VIEWPORT_W}px — 0 findings across ${RULE_NAMES.length} rules`);
  console.log('No live mobile findings.');
  process.exit(0);
}

for (const rule of RULE_NAMES) {
  const list = findings.filter((f) => f.rule === rule);
  if (!list.length) continue;
  console.log(`── ${rule} (${list.length})`);
  for (const f of list) console.log(`   ${f.path}  ${f.detail}`);
  console.log('');
}
console.log(`scanned ${paths.length} live route(s) at ${VIEWPORT_W}px — ${findings.length} findings across ${RULE_NAMES.length} rules`);
for (const [rule, n] of Object.entries(byRule)) {
  if (!RULE_NAMES.includes(rule)) {
    console.error(`UNKNOWN RULE: ${rule}`);
    process.exit(2);
  }
}
process.exit(1);
