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
//   soft-404            a page that says "not found" but answered HTTP 200,
//                        OR a probe path that cannot exist and answered
//                        anything other than 404. Next.js serves its
//                        not-found UI with a 200 when a loading.tsx boundary
//                        streams the shell before the page component throws,
//                        so the break is invisible to a status check but very
//                        visible to a crawler.
//
// Read-only against the target site. Exits non-zero when anything fires,
// so it works as a pre-ship gate. The target host is never authenticated
// against, and nothing is written anywhere.

import { readdirSync, statSync, existsSync } from 'node:fs';
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
];

// ── Main ────────────────────────────────────────────────────────────────────
const chromePath = findChromium();
const port = 9500 + Math.floor(Math.random() * 400);
const profile = `/tmp/omni-live-audit-${port}`;
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

const cleanup = () => { try { chrome.kill('SIGKILL'); } catch { /* already gone */ } };
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

console.log(`auditing ${paths.length} route(s) at ${VIEWPORT_W}px against ${BASE}`);

const findings = [];
const summary = [];

async function auditPath(p) {
  const url = `${BASE}${p}`;
  let targetId;
  try {
    ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }));
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    const consoleErrors = [];
    const resourceErrors = [];

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

    summary.push({ path: p, scrollWidth: page.scrollWidth, count: findings.filter((f) => f.path === p).length });
    if (argv.includes('--debug')) {
      console.log(`   ${p} — status=${page.status} scrollWidth=${page.scrollWidth} vw=${page.width} imgs=${page.imgs} links=${page.links} text=${page.bodyLen} title="${(page.title || '').slice(0, 50)}" errs=${consoleErrors.length} res=${resourceErrors.length}`);
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

const byRule = {};
for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;

console.log('');
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
