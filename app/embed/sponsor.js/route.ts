// Cross-domain sponsor banner. Drop in:
//   <div id="omni-sponsor" data-slug="cps"></div>
//   <script src="https://omnileadsagi.com/embed/sponsor.js" defer></script>
//
// Renders ONE slim, host-adaptive banner per mount point. Uses
// `currentColor` and `color-mix` so the banner blends with whatever
// site it's dropped into — light, dark, branded, anything. No bulky
// stacked cards, no newsletter form, no three-row share strips. One
// banner. One CTA. Server can rotate creatives without a client
// redeploy.

import { NextResponse } from "next/server";

const CACHE_HEADER = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";
const ANALYTICS_HOST = "https://omnileadsagi.com";

const FRED_LINK = "https://circlern.com/host/eef969fc-01ae-4af5-95af-ad0f104488cc";
const LBP_LINK = "https://livebetterpodcast.com";
const CPS_LINK = "https://psychandcustodyevaluations.com";

const CREATIVES = [
  // weight = relative show-rate. Fred wins most rotations as the paid primary.
  {
    id: "fred",
    weight: 5,
    eyebrow: "Sponsor",
    title: "Fred — Live with the Host",
    blurb: "Tap in to Fred's circle. Compound the days.",
    cta: "Open",
    href: FRED_LINK,
    utm: { source: "omni-sponsor", medium: "embed", campaign: "fred-circle" },
  },
  {
    id: "lbp",
    weight: 2,
    eyebrow: "Partner",
    title: "Live Better Podcast",
    blurb: "Show + community from our partner Jaime.",
    cta: "Listen",
    href: LBP_LINK,
    utm: { source: "omni-sponsor", medium: "embed", campaign: "live-better-podcast" },
  },
  {
    id: "cps",
    weight: 2,
    eyebrow: "Featured",
    title: "Psych & Custody Evaluations",
    blurb: "Trusted forensic evaluations across Utah.",
    cta: "Learn",
    href: CPS_LINK,
    utm: { source: "omni-sponsor", medium: "embed", campaign: "cps-feature" },
  },
];

const SCRIPT = /* js */ `(function(){
  var ANALYTICS_HOST = ${JSON.stringify(ANALYTICS_HOST)};
  var CREATIVES = ${JSON.stringify(CREATIVES)};
  var SESSION_KEY = "omni_sponsor_pick_v3";

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
          properties: { creative: creativeId, embed_version: "v3" }
        })
      }).catch(function(){});
    } catch (e) {}
  }

  function pickCreative() {
    // Stable for the session so the visitor doesn't see a different
    // sponsor every navigation. Fresh per session.
    try {
      var cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        var found = CREATIVES.filter(function(c){ return c.id === cached; })[0];
        if (found) return found;
      }
    } catch (e) {}
    var totalWeight = CREATIVES.reduce(function(a,c){ return a + (c.weight || 1); }, 0);
    var roll = Math.random() * totalWeight;
    var picked = CREATIVES[0];
    for (var i = 0; i < CREATIVES.length; i++) {
      roll -= (CREATIVES[i].weight || 1);
      if (roll <= 0) { picked = CREATIVES[i]; break; }
    }
    try { sessionStorage.setItem(SESSION_KEY, picked.id); } catch (e) {}
    return picked;
  }

  function renderInto(host) {
    if (host.dataset.omniSponsorRendered === "1") return;
    host.dataset.omniSponsorRendered = "1";

    var slug = host.dataset.slug || "omni";
    var creative = pickCreative();
    var href = trackedHref(creative, slug);

    // Single slim banner. Inherits font + color so it adapts to host
    // site styling. Border + accent use color-mix on currentColor —
    // looks right on dark, light, and branded backgrounds.
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
      "margin:18px 0",
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

    host.innerHTML = "";
    host.appendChild(a);

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
