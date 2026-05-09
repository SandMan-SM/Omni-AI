// Universal vanilla-JS inbound tracker. Drop-in for any platform —
// Squarespace, WordPress, Cloudflare-fronted sites, raw HTML, etc.
// Same payload shape as the React InboundTracker components on every
// Vercel-deployed Realm I site, so the dashboard treats events from
// either source identically.
//
// Usage (paste in <head> or before </body>):
//   <script src="https://omnileadsagi.com/embed/inbound-tracker.js"
//           data-slug="leifson" defer></script>
//
// Optional attributes:
//   data-slug         — required. Maps to inbound_<slug>_* tables.
//   data-ignore       — comma-separated path prefixes to skip (default "/admin,/api").
//   data-debug="1"    — console.log every event (dev only).

import { NextResponse } from "next/server";

const CACHE = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";
const HOST = "https://omnileadsagi.com";

const SCRIPT = /* js */ `(function(){
  var ANALYTICS_HOST = ${JSON.stringify(HOST)};
  var SCRIPT_TAG = document.currentScript ||
    (function(){
      var ts = document.getElementsByTagName('script');
      for (var i = ts.length - 1; i >= 0; i--) {
        if ((ts[i].src || '').indexOf('inbound-tracker.js') !== -1) return ts[i];
      }
      return null;
    })();

  var SLUG = (SCRIPT_TAG && SCRIPT_TAG.getAttribute('data-slug')) || '';
  if (!SLUG) {
    if (window.console && console.warn) console.warn('[omni-tracker] missing data-slug; skipping');
    return;
  }
  var IGNORE = ((SCRIPT_TAG && SCRIPT_TAG.getAttribute('data-ignore')) || '/admin,/api').split(',');
  var DEBUG = !!(SCRIPT_TAG && SCRIPT_TAG.getAttribute('data-debug'));

  var SESSION_KEY = 'omni_session_' + SLUG;
  var VISITOR_KEY = 'omni_visitor_' + SLUG;
  var REF_KEY     = 'omni_ref_' + SLUG;

  function rid() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10); }
  function ident(key, store) {
    try {
      var v = store.getItem(key);
      if (v) return v;
      v = key.indexOf('visitor') >= 0 ? 'v_' + rid() : 's_' + rid();
      store.setItem(key, v);
      return v;
    } catch (e) { return null; }
  }

  function captureRef() {
    if (typeof localStorage === 'undefined') return;
    try {
      var p = new URLSearchParams(location.search);
      var ref = p.get('ref');
      if (!ref) return;
      if (localStorage.getItem(REF_KEY)) return;
      localStorage.setItem(REF_KEY, JSON.stringify({
        referring_federation_slug: ref,
        referring_creative_id: p.get('utm_campaign') || null,
        first_referral_ts: Date.now()
      }));
    } catch (e) {}
  }
  function readRef() {
    if (typeof localStorage === 'undefined') return {};
    try {
      var raw = localStorage.getItem(REF_KEY);
      if (!raw) return {};
      var r = JSON.parse(raw);
      return {
        referring_federation_slug: r.referring_federation_slug || undefined,
        referring_creative_id: r.referring_creative_id || undefined
      };
    } catch (e) { return {}; }
  }

  function utm() {
    try {
      var p = new URLSearchParams(location.search);
      var o = {};
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){
        var v = p.get(k); if (v) o[k] = v;
      });
      return o;
    } catch (e) { return {}; }
  }

  function send(payload, opts) {
    if (typeof window === 'undefined') return;
    var body = JSON.stringify(Object.assign({}, payload, readRef(), {
      visitor_id: ident(VISITOR_KEY, localStorage),
      session_id: ident(SESSION_KEY, sessionStorage),
      user_agent: navigator.userAgent,
      page_url: location.href,
      referrer: document.referrer || null
    }, utm()));
    var url = ANALYTICS_HOST + '/api/inbound/' + encodeURIComponent(SLUG) + '/events';
    if (DEBUG && console && console.log) console.log('[omni-tracker]', payload);
    if (opts && opts.beacon && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      } catch (e) {}
    }
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).catch(function(){});
    } catch (e) {}
  }

  function shouldIgnore(path) {
    for (var i = 0; i < IGNORE.length; i++) {
      var p = IGNORE[i].trim();
      if (p && path.indexOf(p) === 0) return true;
    }
    return false;
  }

  // ── Pageview (and history-API SPA navigations) ──
  var lastPath = '';
  var scrollFired = {};
  function pageView() {
    var path = location.pathname + (location.search || '');
    if (path === lastPath) return;
    if (shouldIgnore(location.pathname)) return;
    lastPath = path;
    scrollFired = {};
    send({
      event_type: 'page_view',
      event_category: 'navigation',
      action: 'view',
      target_type: 'page',
      properties: {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        title: (document.title || '').slice(0, 200)
      }
    });
  }

  captureRef();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageView);
  } else {
    pageView();
  }

  // SPA hooks — push/replaceState + hashchange + popstate
  var origPush = history.pushState;
  history.pushState = function(){ origPush.apply(this, arguments); setTimeout(pageView, 0); };
  var origReplace = history.replaceState;
  history.replaceState = function(){ origReplace.apply(this, arguments); setTimeout(pageView, 0); };
  window.addEventListener('popstate', pageView);
  window.addEventListener('hashchange', pageView);

  // ── Click tracking ──
  function findTarget(node) {
    if (!(node instanceof HTMLElement)) return null;
    var el = node;
    for (var i = 0; i < 8 && el; i++) {
      if (el.dataset && el.dataset.track) return el;
      if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') return el;
      el = el.parentElement;
    }
    return null;
  }
  function labelFor(el, href) {
    if (href && href.indexOf('tel:') === 0) return 'tel:' + href.slice(4);
    var ds = el.dataset && el.dataset.track; if (ds) return ds.slice(0, 120);
    var aria = el.getAttribute('aria-label'); if (aria) return aria.slice(0, 120);
    var t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (t) return t.slice(0, 120);
    if (el.tagName === 'A') return 'link:' + (href || '').slice(0, 120);
    return el.tagName.toLowerCase();
  }
  document.addEventListener('click', function(e) {
    var el = findTarget(e.target);
    if (!el) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    var href = el.tagName === 'A' ? el.getAttribute('href') : null;
    var label = labelFor(el, href);
    var isOutbound = href && /^https?:\\/\\//i.test(href) && href.indexOf(location.host) < 0;
    var isTel = !!(href && href.indexOf('tel:') === 0);
    var isMail = !!(href && href.indexOf('mailto:') === 0);
    send({
      event_type: 'click',
      event_category: (isTel || isMail) ? 'conversion' : 'interaction',
      action: 'click',
      target_type: el.tagName.toLowerCase(),
      target_id: label,
      value_text: label,
      properties: {
        href: href || undefined,
        outbound: isOutbound || undefined,
        tel: isTel || undefined,
        mailto: isMail || undefined
      }
    }, { beacon: !!href });
  }, { capture: true, passive: true });

  // ── Form submit tracking ──
  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (!(f instanceof HTMLFormElement)) return;
    var label = f.getAttribute('data-track') || f.getAttribute('name') || f.getAttribute('id') || 'form';
    send({
      event_type: 'form_submit',
      event_category: 'conversion',
      action: 'submit',
      target_type: 'form',
      target_id: label,
      value_text: label
    });
  }, { capture: true });

  // ── Scroll depth (25/50/75/100) ──
  var rafId = 0;
  function scrollCheck() {
    rafId = 0;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (max <= 0) return;
    var pct = Math.round((h.scrollTop / max) * 100);
    [25, 50, 75, 100].forEach(function(m) {
      if (pct >= m && !scrollFired[m]) {
        scrollFired[m] = true;
        send({
          event_type: 'scroll',
          event_category: 'engagement',
          action: 'reach',
          target_type: 'page',
          target_id: 'scroll_' + m,
          value_numeric: m
        });
      }
    });
  }
  window.addEventListener('scroll', function() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(scrollCheck);
  }, { passive: true });
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": CACHE,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const dynamic = "force-dynamic";
