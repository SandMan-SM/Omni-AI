// Stage N.0 — universal federation cross-ad embed.
//
// Drop in:
//   <div id="omni-fedad-footer" data-slot="footer" data-slug="<originating>"></div>
//   <script src="https://omnileadsagi.com/embed/federation-ad.js" defer></script>
//
// Pulls a creative from /api/cross-ads, renders one slim banner, and
// pings click attribution back to /api/cross-ads/click. Inherits host
// font + currentColor so it adapts to whatever site it's mounted on.

import { NextResponse } from "next/server";

const CACHE_HEADER = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";
const ANALYTICS_HOST = "https://omnileadsagi.com";

const SCRIPT = /* js */ `(function(){
  var ANALYTICS_HOST = ${JSON.stringify(ANALYTICS_HOST)};
  var SESSION_KEY  = "omni_fedad_session_v1";
  var VISITOR_KEY  = "omni_fedad_visitor_v1";

  function ident(key, store) {
    try {
      var v = store.getItem(key);
      if (v) return v;
      v = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      store.setItem(key, v);
      return v;
    } catch (e) { return null; }
  }

  function getSession() { return typeof sessionStorage !== "undefined" ? ident(SESSION_KEY, sessionStorage) : null; }
  function getVisitor() { return typeof localStorage !== "undefined" ? ident(VISITOR_KEY, localStorage) : null; }

  function fetchCreative(slug, slot) {
    var u = new URL(ANALYTICS_HOST + "/api/cross-ads");
    u.searchParams.set("slug", slug);
    u.searchParams.set("slot", slot);
    var v = getVisitor(); if (v) u.searchParams.set("visitor", v);
    var s = getSession(); if (s) u.searchParams.set("session", s);
    u.searchParams.set("page", location.pathname || "/");
    return fetch(u.toString(), { method: "GET", credentials: "omit", mode: "cors" })
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }

  function logClick(creativeId, slug, href) {
    try {
      fetch(ANALYTICS_HOST + "/api/cross-ads/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          creative_id: creativeId,
          visitor_id: getVisitor(),
          session_id: getSession(),
          originating_slug: slug,
          page_path: location.pathname || "/",
          attribution_url: href
        })
      }).catch(function(){});
    } catch (e) {}
  }

  function build(creative, slug) {
    var a = document.createElement("a");
    a.href = creative.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("data-omni-fedad", creative.id);
    a.style.cssText = [
      "display:flex","align-items:center","gap:14px",
      "width:100%","max-width:100%","box-sizing:border-box",
      "padding:12px 18px","margin:18px 0","border-radius:10px",
      "border:1px solid color-mix(in srgb, currentColor 16%, transparent)",
      "background:color-mix(in srgb, currentColor 3%, transparent)",
      "text-decoration:none","color:inherit","font:inherit","line-height:1.35",
      "transition:border-color .2s ease, background .2s ease","cursor:pointer"
    ].join(";");

    a.addEventListener("mouseenter", function(){
      a.style.borderColor = "color-mix(in srgb, currentColor 30%, transparent)";
      a.style.background  = "color-mix(in srgb, currentColor 6%, transparent)";
    });
    a.addEventListener("mouseleave", function(){
      a.style.borderColor = "color-mix(in srgb, currentColor 16%, transparent)";
      a.style.background  = "color-mix(in srgb, currentColor 3%, transparent)";
    });

    var dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = "flex-shrink:0;width:8px;height:8px;border-radius:999px;background:currentColor;opacity:.55;";

    var body = document.createElement("span");
    body.style.cssText = "flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;";

    var eyebrow = document.createElement("span");
    eyebrow.textContent = creative.eyebrow || "Federation";
    eyebrow.style.cssText = "font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.7;";

    var title = document.createElement("span");
    title.textContent = creative.headline || "";
    title.style.cssText = "font-weight:600;font-size:14px;";

    body.appendChild(eyebrow);
    body.appendChild(title);

    if (creative.blurb) {
      var sep = document.createElement("span");
      sep.textContent = "·";
      sep.style.cssText = "opacity:.35;font-size:12px;";
      var blurb = document.createElement("span");
      blurb.textContent = creative.blurb;
      blurb.style.cssText = "font-size:13px;opacity:.72;";
      body.appendChild(sep);
      body.appendChild(blurb);
    }

    var cta = document.createElement("span");
    cta.textContent = (creative.cta_text || "Open") + " →";
    cta.style.cssText = "flex-shrink:0;font-size:12px;font-weight:700;letter-spacing:.04em;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in srgb, currentColor 22%, transparent);";

    a.appendChild(dot);
    a.appendChild(body);
    a.appendChild(cta);

    a.addEventListener("click", function(){ logClick(creative.id, slug, creative.href); });

    return a;
  }

  function renderInto(host) {
    if (host.dataset.omniFedadRendered === "1") return;
    host.dataset.omniFedadRendered = "1";

    var slug = host.dataset.slug || (typeof location !== "undefined" ? location.hostname.split(".").shift() : "unknown");
    var slot = host.dataset.slot || "footer";

    fetchCreative(slug, slot).then(function(payload){
      if (!payload || !payload.creative) return;
      host.innerHTML = "";
      host.appendChild(build(payload.creative, slug));
    });
  }

  function scan() {
    var hosts = document.querySelectorAll('[id^="omni-fedad"], [data-omni-fedad-mount]');
    hosts.forEach(renderInto);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
  if (typeof MutationObserver === "function") {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": CACHE_HEADER,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const dynamic = "force-dynamic";
