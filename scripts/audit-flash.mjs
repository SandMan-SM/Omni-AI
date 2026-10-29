#!/usr/bin/env node
// First-paint canvas audit — measures whether the site shows a white flash
// while its stylesheet is still downloading.
//
// Why this exists: the site's canvas is near-black (`--background: 0 0% 2%`),
// but that token lives in `app/globals.css`, and under a realistic mobile
// profile (1.6 Mbps / 150 ms RTT) the document streamed at ~0.8 s while the
// stylesheet did not land until ~2.5 s. For ~1.8 s the visitor was looking at
// the browser's default WHITE canvas with dark content painted on it, on
// every page of a near-black site. Nothing in `tsc`, `next build`, the static
// mobile gate or the live mobile gate can see it: they all inspect either
// the source or the *settled* page.
//
// Two measurement facts make this easy to get wrong, and both produce a
// reassuring false negative:
//
//   1. The canvas is painted with the `<html>` element's background whenever
//      the `<body>` background is transparent — and the body is transparent
//      by default. A probe that reads `document.body` sees
//      `rgba(0, 0, 0, 0)` forever and cannot tell "no background set" from
//      "background set to the page background". The metric is
//      `document.documentElement`.
//
//   2. The flash is only visible if the page has CONTENT while the canvas is
//      still light. A page that is empty for 2 s and then dark shows no
//      flash. So the measurement has to compare two timestamps: when the
//      body first had content, and when the canvas first became dark.
//
// The audit drives the Chrome DevTools Protocol directly over Node's global
// WebSocket (Node 18+; this repo runs Node 24) — no new dependency, reusing
// the chromium binary Playwright already cached on this machine, exactly as
// `scripts/audit-live-mobile.mjs` does.
//
//   node scripts/audit-flash.mjs                          # prod, default routes
//   node scripts/audit-flash.mjs --base=http://localhost:3001
//   node scripts/audit-flash.mjs --route=/newsletter --route=/pricing
//   node scripts/audit-flash.mjs --all                    # every sitemap URL
//
// Rule (RULE_NAMES):
//   canvas-light-while-content-painted
//       The page had content before the canvas was dark — the visitor saw a
//       light canvas under dark content.
//
// Read-only against the target site. Exits non-zero when anything fires, so
// it works as a pre-ship gate. Nothing is written and nothing is
// authenticated against.

import { readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const RULE_NAMES = ['canvas-light-while-content-painted'];

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  // Accept both `--name value` and `--name=value`. The `=` form is the one
  // people actually type, and silently falling back to the default host on a
  // typo'd flag is how you end up auditing production by accident.
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(name);
const BASE = arg('--base', 'https://omnileadsagi.com').replace(/\/+$/, '');
const ALL = flag('--all');

// Routes that exercise the root layout. The flash is a property of the root
// layout's <head>, so a handful of routes covers it; the point of probing
// several is to catch a route that overrides the head.
const DEFAULT_ROUTES = ['/', '/newsletter', '/pricing', '/about', '/search'];

const VIEWPORT_W = 375;
const VIEWPORT_H = 812;
// A "realistic mobile" profile: 1.6 Mbps down, 150 ms RTT.
const THROTTLE_DOWNLOAD_BPS = (1.6 * 1024 * 1024) / 8;
const THROTTLE_UPLOAD_BPS = (750 * 1024) / 8;
const THROTTLE_LATENCY_MS = 150;
// How long to keep sampling after navigation before giving up on the route.
const SAMPLE_WINDOW_MS = 8000;
const SAMPLE_INTERVAL_MS = 50;

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
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

/**
 * Is this computed background a dark colour?
 *
 * The threshold is deliberately loose (each channel ≤ 40) — it is not a
 * design assertion, it is a "is the canvas light or dark" test. A transparent
 * background is not dark: it means the browser default (white) shows through.
 */
function isDark(bg) {
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false;
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bg);
  if (!m) return false;
  return Number(m[1]) <= 40 && Number(m[2]) <= 40 && Number(m[3]) <= 40;
}

async function probeRoute(route) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = `/tmp/audit-flash-${port}-${process.pid}`;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    findChromium(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
    ],
    { stdio: 'ignore' },
  );
  const cleanup = () => {
    try {
      chrome.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  };
  process.on('exit', cleanup);

  try {
    let wsUrl = null;
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (r.ok) {
          wsUrl = (await r.json()).webSocketDebuggerUrl;
          break;
        }
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!wsUrl) throw new Error('chromium did not expose a CDP endpoint');

    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    const cdp = new CDP(ws);

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 1, mobile: true },
      sessionId,
    );
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send(
      'Network.emulateNetworkConditions',
      {
        offline: false,
        latency: THROTTLE_LATENCY_MS,
        downloadThroughput: THROTTLE_DOWNLOAD_BPS,
        uploadThroughput: THROTTLE_UPLOAD_BPS,
      },
      sessionId,
    );

    const t0 = Date.now();
    await cdp.send('Page.navigate', { url: `${BASE}${route}` }, sessionId);

    let contentAtMs = null;
    let contentBg = null;
    let darkAtMs = null;
    let lastHtmlBg = null;

    for (let i = 0; i * SAMPLE_INTERVAL_MS < SAMPLE_WINDOW_MS; i++) {
      await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
      const res = await cdp.send(
        'Runtime.evaluate',
        {
          expression: `(()=>{const h=document.documentElement,b=document.body;
            if(!b)return null;
            return {html:getComputedStyle(h).backgroundColor,h:b.scrollHeight};})()`,
          returnByValue: true,
        },
        sessionId,
      );
      const v = res && res.result && res.result.value;
      if (!v) continue;
      const now = Date.now() - t0;
      if (v.html !== lastHtmlBg) {
        lastHtmlBg = v.html;
        if (isDark(v.html) && darkAtMs === null) darkAtMs = now;
      }
      // "Content" means the document is tall enough to be showing something.
      // 100px avoids counting the empty shell as content.
      if (contentAtMs === null && v.h > 100) {
        contentAtMs = now;
        contentBg = v.html;
        // The canvas colour AT the moment content appeared is what the
        // visitor was actually looking at.
        if (isDark(v.html) && darkAtMs === null) darkAtMs = now;
      }
      if (contentAtMs !== null && darkAtMs !== null) break;
    }

    ws.close();
    cleanup();

    if (contentAtMs === null) {
      // Nothing painted inside the window — not a flash, and not a pass
      // either. Report it so a broken route cannot read as "clean".
      return { route, inconclusive: true, contentAtMs, darkAtMs, contentBg, lastHtmlBg };
    }
    const flashed = !isDark(contentBg);
    return { route, inconclusive: false, flashed, contentAtMs, darkAtMs, contentBg, lastHtmlBg };
  } catch (err) {
    cleanup();
    return { route, error: err.message };
  }
}

async function sitemapRoutes() {
  try {
    const res = await fetch(`${BASE}/sitemap.xml`);
    if (!res.ok) return [];
    const xml = await res.text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => new URL(m[1].trim()).pathname)
      .filter((p) => p.startsWith('/'));
    return paths.slice(0, 40);
  } catch {
    return [];
  }
}

async function main() {
  let routes = argv
    .filter((a) => a.startsWith('--route='))
    .map((a) => a.slice('--route='.length));
  if (ALL) {
    const fromSitemap = await sitemapRoutes();
    routes = fromSitemap.length ? fromSitemap : DEFAULT_ROUTES;
  }
  if (!routes.length) routes = DEFAULT_ROUTES;

  console.log(`auditing ${routes.length} route(s) for a first-paint white flash against ${BASE}`);
  console.log(`throttle: ${(THROTTLE_DOWNLOAD_BPS * 8 / 1024 / 1024).toFixed(1)} Mbps / ${THROTTLE_LATENCY_MS} ms RTT, ${VIEWPORT_W}x${VIEWPORT_H}\n`);

  const findings = [];
  let worst = null;

  for (const route of routes) {
    const r = await probeRoute(route);
    if (r.error) {
      console.log(`  ${route}  ERROR ${r.error}`);
      continue;
    }
    if (r.inconclusive) {
      console.log(`  ${route}  INCONCLUSIVE — no content painted within ${SAMPLE_WINDOW_MS} ms`);
      findings.push({
        rule: 'canvas-light-while-content-painted',
        route,
        detail: `no content painted within ${SAMPLE_WINDOW_MS} ms, so the canvas colour could not be measured (last html background: ${r.lastHtmlBg})`,
      });
      continue;
    }
    const flashMs = r.darkAtMs === null ? null : r.darkAtMs - r.contentAtMs;
    const line = `  ${route}  content at ${r.contentAtMs} ms  canvas ${r.contentBg}  dark at ${r.darkAtMs ?? 'never'} ms`;
    console.log(r.flashed ? `${line}  ← FLASH` : line);
    if (r.flashed) {
      findings.push({
        rule: 'canvas-light-while-content-painted',
        route,
        detail: `the page painted content at ${r.contentAtMs} ms while the canvas was still ${r.contentBg}; the canvas only became dark at ${r.darkAtMs ?? 'never'} ms — the visitor saw a light canvas under dark content`,
      });
    }
    if (r.flashed && (worst === null || r.contentAtMs > worst.contentAtMs)) worst = r;
  }

  for (const f of findings) {
    if (!RULE_NAMES.includes(f.rule)) throw new Error(`unregistered rule name: ${f.rule}`);
    console.log(`\n${f.route}  ${f.rule}\n    ${f.detail}`);
  }

  console.log(
    `\nscanned ${routes.length} route(s) — ${findings.length} finding(s) across ${RULE_NAMES.length} rule(s)`,
  );
  if (findings.length === 0) console.log('No first-paint flash findings.');
  process.exit(findings.length > 0 ? 1 : 0);
}

main();
