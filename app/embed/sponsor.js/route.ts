// Cross-domain Partner Network banner. Drop in:
//   <div id="omni-sponsor" data-slug="cps"></div>
//   <script src="https://omnileadsagi.com/embed/sponsor.js" defer></script>
//
// v4 — the banner now rotates the FULL Omni Partner Network (see
// lib/partner-network.ts, the single source of truth) instead of a
// fixed 3-creative list. The host's data-slug drives mesh rules
// client-side: a site never promotes itself, clinical hosts only see
// audience-appropriate categories, and Fred Circle keeps the paid
// primary weight everywhere. Server can change the network without a
// client redeploy; sites cache one shared script.
//
// Renders ONE slim, host-adaptive banner per mount point. Uses
// `currentColor` and `color-mix` so the banner blends with whatever
// site it's dropped into — light, dark, branded, anything.

import { NextResponse } from "next/server";
import { PARTNER_NETWORK } from "@/lib/partner-network";

const CACHE_HEADER = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";
const ANALYTICS_HOST = "https://omnileadsagi.com";
const NETWORK_PAGE = "https://omnileadsagi.com/network";

// Compact creative payload for the client (keeps script small).
const CREATIVES = PARTNER_NETWORK.map((m) => ({
  id: m.slug,
  weight: m.weight,
  eyebrow: m.eyebrow,
  title: m.name,
  blurb: m.tagline,
  cta: m.cta,
  href: m.href,
  category: m.category,
  utm: { source: "omni-sponsor", medium: "embed", campaign: m.utmCampaign },
}));

const SCRIPT = /* js */ `(function(){
  var ANALYTICS_HOST = ${JSON.stringify(ANALYTICS_HOST)};
  var NETWORK_PAGE = ${JSON.stringify(NETWORK_PAGE)};
  var CREATIVES = ${JSON.stringify(CREATIVES)};
  var SESSION_KEY = "omni_sponsor_pick_v4";

  // Mesh rules — mirror of lib/partner-network.ts creativesForHost().
  var CLINICAL_HOSTS = { cps: 1 };
  var CLINICAL_ALLOWED = { professional: 1, media: 1, community: 1 };
  var HOST_TO_MEMBER = {
    cps: "cps", leifson: "leifson", youngs: "youngs", ltb: "ltb",
    alira: "alira", prime_iv: "prime_iv", rene: "rene",
    omnileads: "omnileads", omni: "omnileadsagi"
  };

  function poolForHost(slug) {
    var self = HOST_TO_MEMBER[slug] || slug;
    var pool = CREATIVES.filter(function(c){ return c.id !== self; });
    if (CLINICAL_HOSTS[slug]) {
      pool = pool.filter(function(c){
        return c.id === "fred-circle" || CLINICAL_ALLOWED[c.category];
      });
    }
    return pool.length ? pool : CREATIVES;
  }

  function trackedHref(c, slug) {
    try {
      var u = new URL(c.href);
      u.searchParams.set("utm_source", c.utm.source);
      u.searchParams.set("utm_medium", c.utm.medium);
      u.searchParams.set("utm_campaign", c.utm.campaign);
      u.searchParams.set("ref", slug);
      return u.toString();
    } catch (e) { return c.href; }
  }

  function ping(slug, creativeId, action) {
    if (!slug) return;
    try {
      fetch(ANALYTICS_HOST + "/api/inbound/" + encodeURIComponent(slug) + "/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          event_type: "sponsor_" + action,
          event_category: "sponsor",
          action: action,
          target_id: creativeId,
          target_type: "sponsor_banner",
          page_url: location.href,
          properties: { creative: creativeId, embed_version: "v4" }
        })
      }).catch(function(){});
    } catch (e) {}
  }

  function pickCreative(slug) {
    var pool = poolForHost(slug);
    // Stable for the session so the visitor doesn't see a different
    // partner every navigation. Fresh per session.
    try {
      var cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        var found = pool.filter(function(c){ return c.id === cached; })[0];
        if (found) return found;
      }
    } catch (e) {}
    var totalWeight = pool.reduce(function(a,c){ return a + (c.weight || 1); }, 0);
    var roll = Math.random() * totalWeight;
    var picked = pool[0];
    for (var i = 0; i < pool.length; i++) {
      roll -= (pool[i].weight || 1);
      if (roll <= 0) { picked = pool[i]; break; }
    }
    try { sessionStorage.setItem(SESSION_KEY, picked.id); } catch (e) {}
    return picked;
  }

  function renderInto(host) {
    if (host.dataset.omniSponsorRendered === "1") return;
    host.dataset.omniSponsorRendered = "1";

    var slug = host.dataset.slug || "omni";
    var creative = pickCreative(slug);
    var href = trackedHref(creative, slug);

    // Single slim banner. Inherits font + color so it adapts to host
    // site styling. Border + accent use color-mix on currentColor —
    // looks right on dark, light, and branded backgrounds.
    var wrap = document.createElement("span");
    wrap.style.cssText = "display:block;margin:18px 0;";

    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "sponsored noopener noreferrer";
    a.setAttribute("data-omni-creative", creative.id);
    a.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:14px",
      "width:100%",
      "max-width:100%",
      "box-sizing:border-box",
      "padding:12px 18px",
      "border-radius:10px",
      "border:1px solid color-mix(in srgb, currentColor 18%, transparent)",
      "background:color-mix(in srgb, currentColor 4%, transparent)",
      "text-decoration:none",
      "color:inherit",
      "font:inherit",
      "line-height:1.35",
      "transition:border-color .2s ease, background .2s ease",
      "cursor:pointer"
    ].join(";");

    a.addEventListener("mouseenter", function(){
      a.style.borderColor = "color-mix(in srgb, currentColor 32%, transparent)";
      a.style.background  = "color-mix(in srgb, currentColor 7%, transparent)";
    });
    a.addEventListener("mouseleave", function(){
      a.style.borderColor = "color-mix(in srgb, currentColor 18%, transparent)";
      a.style.background  = "color-mix(in srgb, currentColor 4%, transparent)";
    });

    var dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = [
      "flex-shrink:0",
      "width:8px",
      "height:8px",
      "border-radius:999px",
      "background:currentColor",
      "opacity:.55"
    ].join(";");

    var body = document.createElement("span");
    body.style.cssText = "flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;";

    var eyebrow = document.createElement("span");
    eyebrow.textContent = creative.eyebrow;
    eyebrow.style.cssText = [
      "font-size:10px",
      "font-weight:700",
      "letter-spacing:.18em",
      "text-transform:uppercase",
      "opacity:.7"
    ].join(";");

    var title = document.createElement("span");
    title.textContent = creative.title;
    title.style.cssText = "font-weight:600;font-size:14px;";

    var sep = document.createElement("span");
    sep.textContent = "·";
    sep.style.cssText = "opacity:.35;font-size:12px;";

    var blurb = document.createElement("span");
    blurb.textContent = creative.blurb;
    blurb.style.cssText = "font-size:13px;opacity:.72;";

    body.appendChild(eyebrow);
    body.appendChild(title);
    body.appendChild(sep);
    body.appendChild(blurb);

    var cta = document.createElement("span");
    cta.textContent = creative.cta + " →";
    cta.style.cssText = [
      "flex-shrink:0",
      "font-size:12px",
      "font-weight:700",
      "letter-spacing:.04em",
      "padding:4px 10px",
      "border-radius:999px",
      "border:1px solid color-mix(in srgb, currentColor 24%, transparent)"
    ].join(";");

    a.appendChild(dot);
    a.appendChild(body);
    a.appendChild(cta);

    a.addEventListener("click", function(){ ping(slug, creative.id, "click"); });

    // "Omni Partner Network" micro-label — the partnership's public
    // face. Gives every host site a shareable proof point and every
    // visitor the full network in one click.
    var label = document.createElement("a");
    label.href = NETWORK_PAGE + "?ref=" + encodeURIComponent(slug);
    label.target = "_blank";
    label.rel = "noopener noreferrer";
    label.textContent = "Omni Partner Network";
    label.style.cssText = [
      "display:inline-block",
      "margin-top:4px",
      "font-size:10px",
      "letter-spacing:.14em",
      "text-transform:uppercase",
      "opacity:.45",
      "color:inherit",
      "text-decoration:none"
    ].join(";");
    label.addEventListener("mouseenter", function(){ label.style.opacity = ".75"; });
    label.addEventListener("mouseleave", function(){ label.style.opacity = ".45"; });

    wrap.appendChild(a);
    wrap.appendChild(label);

    host.innerHTML = "";
    host.appendChild(wrap);

    // Impression ping — once per render
    ping(slug, creative.id, "view");
  }

  function scan() {
    var hosts = document.querySelectorAll('[id="omni-sponsor"], [data-omni-sponsor]');
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
