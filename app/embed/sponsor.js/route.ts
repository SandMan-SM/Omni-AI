// Cross-domain embed: client sites drop in
//   <div id="omni-sponsor" data-slug="cps"></div>
//   <script src="https://omnileadsagi.com/embed/sponsor.js" defer></script>
//
// And get the canonical Fred sponsor + Live Better Podcast block
// rendered into that div, with share controls and analytics ping
// already wired. ZERO React on the receiving end — vanilla JS that
// works in any framework / static site / WordPress / Webflow.
//
// Why a route, not a static asset:
//   - We can swap out copy / sponsor without touching any client repo.
//   - We can add new platforms (e.g. when Fred's sponsorship rotates).
//   - We can target /version-bump straight from the operator dashboard
//     and every site picks it up on next page load.

import { NextResponse } from "next/server";

// 24-hour edge cache + 1-hour stale-while-revalidate so we don't smash
// the origin on every page view, but copy/sponsor changes propagate
// fast.
const CACHE_HEADER = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

const ANALYTICS_HOST = "https://omnileadsagi.com";
const FRED_LINK = "https://circlern.com/host/eef969fc-01ae-4af5-95af-ad0f104488cc";
const LBP_LINK = "https://livebetterpodcast.com";
const CPS_LINK = "https://psychandcustodyevaluations.com";

const SCRIPT = /* js */ `(function(){
  // ── omni-sponsor v2 ───────────────────────────────────────────────
  // Three-tier feature block:
  //   1. Fred (paid sponsor, primary)
  //   2. Live Better Podcast (strategic partnership, secondary)
  //   3. CPS · Psych & Custody Evaluations (featured client, tertiary)
  // Plus share affordances + newsletter capture. Renders into every
  // <div id="omni-sponsor" data-slug="..."> on the page. Re-runs on
  // SPA navigations via MutationObserver so framework apps work too.
  var ANALYTICS_HOST = ${JSON.stringify(ANALYTICS_HOST)};
  var FRED = ${JSON.stringify(FRED_LINK)};
  var LBP = ${JSON.stringify(LBP_LINK)};
  var CPS = ${JSON.stringify(CPS_LINK)};

  function trackedHref(target, slug) {
    try {
      var base = target === 'fred' ? FRED : target === 'lbp' ? LBP : CPS;
      var u = new URL(base);
      u.searchParams.set('utm_source', 'omni-' + slug);
      u.searchParams.set('utm_medium', 'newsletter');
      u.searchParams.set('utm_campaign',
        target === 'fred' ? 'fred-circle' :
        target === 'lbp' ? 'live-better-podcast' :
        'cps-feature');
      return u.toString();
    } catch (e) {
      return target === 'fred' ? FRED : target === 'lbp' ? LBP : CPS;
    }
  }

  function ping(slug, target, action, props) {
    if (!slug) return;
    try {
      fetch(ANALYTICS_HOST + '/api/inbound/' + encodeURIComponent(slug) + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_type: 'sponsor_' + action,
          event_category: 'sponsor',
          action: action,
          target_id: target,
          target_type: 'sponsor_card',
          page_url: location.href,
          properties: Object.assign({ sponsor: target }, props || {})
        })
      }).catch(function(){});
    } catch (e) {}
  }

  function pingShare(slug, target, platform, url) {
    if (!slug) return;
    try {
      fetch(ANALYTICS_HOST + '/api/inbound/' + encodeURIComponent(slug) + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_type: 'share',
          event_category: 'share',
          action: 'click',
          target_id: target,
          target_type: 'share_button',
          page_url: location.href,
          properties: { platform: platform, share_url: url }
        })
      }).catch(function(){});
    } catch (e) {}
  }

  function shareIntents(target, slug, url, title) {
    return [
      navigator.share ? { key: 'native', label: 'Share', click: function(){
        pingShare(slug, target, 'native', url);
        navigator.share({ title: title, url: url }).catch(function(){});
      }} : null,
      { key: 'twitter', label: 'X / Twitter', click: function(){
        pingShare(slug, target, 'twitter', url);
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
      }},
      { key: 'linkedin', label: 'LinkedIn', click: function(){
        pingShare(slug, target, 'linkedin', url);
        window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url), '_blank', 'noopener');
      }},
      { key: 'sms', label: 'SMS', click: function(){
        pingShare(slug, target, 'sms', url);
        location.href = 'sms:?body=' + encodeURIComponent(title + ' — ' + url);
      }},
      { key: 'email', label: 'Email', click: function(){
        pingShare(slug, target, 'email', url);
        location.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(title + '\\n\\n' + url);
      }},
      { key: 'copy', label: 'Copy link', click: function(btn){
        pingShare(slug, target, 'copy', url);
        try {
          navigator.clipboard.writeText(url);
          if (btn) {
            var prev = btn.textContent;
            btn.textContent = 'Copied ✓';
            setTimeout(function(){ btn.textContent = prev; }, 1800);
          }
        } catch (e) {}
      }}
    ].filter(Boolean);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') node.style.cssText = attrs.style;
      else if (k === 'html') node.innerHTML = attrs.html;
      else node.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(function(c){
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function shareRow(target, slug, url, title) {
    var row = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;font-size:12px;' });
    shareIntents(target, slug, url, title).forEach(function(intent){
      var btn = el('button', {
        type: 'button',
        style: 'background:transparent;border:1px solid #3f3f46;color:#d4d4d8;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;'
      }, [intent.label]);
      btn.addEventListener('click', function(e){ e.preventDefault(); intent.click(btn); });
      row.appendChild(btn);
    });
    return row;
  }

  function newsletterForm(slug, brand) {
    var form = el('form', {
      style: 'background:#111;border:1px solid #27272a;border-radius:14px;padding:20px 22px;margin:20px 0;font-family:inherit;'
    });
    var head = el('div', { style: 'font-size:16px;font-weight:700;color:#fafafa;margin-bottom:4px;' }, ['Get the dispatch']);
    var sub = el('div', { style: 'font-size:13px;color:#a1a1aa;margin-bottom:14px;' }, ['One short post a day. Sponsor + partner picks. Unsubscribe anytime.']);
    var row = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' });
    var input = el('input', {
      type: 'email', required: 'true', placeholder: 'you@company.com',
      style: 'flex:1 1 220px;background:#1a1a1a;border:1px solid #3f3f46;color:#fafafa;padding:10px 12px;border-radius:8px;font-size:14px;font-family:inherit;'
    });
    var btn = el('button', {
      type: 'submit',
      style: 'background:#f59e0b;color:#0a0a0a;border:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;'
    }, ['Subscribe']);
    var msg = el('div', { style: 'font-size:12px;margin-top:8px;color:#a1a1aa;' });
    row.appendChild(input); row.appendChild(btn);
    form.appendChild(head); form.appendChild(sub); form.appendChild(row); form.appendChild(msg);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var email = (input.value || '').trim().toLowerCase();
      if (!email || !/.+@.+\\..+/.test(email)) { msg.style.color = '#f87171'; msg.textContent = 'Enter a valid email'; return; }
      btn.disabled = true; btn.textContent = 'Subscribing…'; msg.textContent = '';
      fetch(ANALYTICS_HOST + '/api/inbound/' + encodeURIComponent(slug) + '/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          source: 'newsletter_subscribe',
          page_path: location.pathname,
          utm_source: new URLSearchParams(location.search).get('utm_source'),
          utm_medium: 'sponsor_block',
          utm_campaign: brand.toLowerCase().replace(/\\s+/g, '-')
        })
      }).then(function(r){
        if (!r.ok) throw new Error('HTTP ' + r.status);
        btn.style.background = '#10b981';
        btn.textContent = '✓ Subscribed';
        msg.style.color = '#10b981';
        msg.textContent = "You're in. Watch your inbox.";
        input.value = '';
      }).catch(function(err){
        btn.disabled = false;
        btn.textContent = 'Subscribe';
        msg.style.color = '#f87171';
        msg.textContent = (err && err.message) || 'Subscribe failed';
      });
    });
    return form;
  }

  function renderInto(host) {
    if (host.dataset.omniSponsorRendered === '1') return;
    host.dataset.omniSponsorRendered = '1';

    var slug = host.dataset.slug || 'omni-ai';
    var brand = host.dataset.brand || 'Omni AI';

    // PRIMARY — Fred sponsor
    var fredHref = trackedHref('fred', slug);
    var fredCard = el('a', {
      href: fredHref, target: '_blank', rel: 'noopener noreferrer',
      style: 'display:block;background:linear-gradient(135deg,#1a1a1a 0%,#1f1410 100%);border:1px solid #f59e0b66;border-radius:14px;padding:22px 24px;text-decoration:none;color:#fafafa;margin-bottom:16px;'
    });
    fredCard.innerHTML = '<div style="display:flex;align-items:flex-start;gap:16px;justify-content:space-between;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f59e0b;margin-bottom:6px;">Sponsor</div>'
      + '<div style="font-size:19px;font-weight:700;margin-bottom:6px;line-height:1.25;">Fred Circle — Live with the Host</div>'
      + '<div style="font-size:14px;color:#a1a1aa;line-height:1.55;">Tap in to Fred\\'s live host event. Sponsor of this dispatch — the click goes straight to him.</div>'
      + '</div>'
      + '<span style="flex-shrink:0;background:#f59e0b;color:#0a0a0a;padding:10px 16px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;">Open →</span>'
      + '</div>';
    fredCard.addEventListener('click', function(){ ping(slug, 'fred', 'click'); });

    // SECONDARY — Live Better Podcast partnership
    var lbpHref = trackedHref('lbp', slug);
    var lbpCard = el('a', {
      href: lbpHref, target: '_blank', rel: 'noopener noreferrer',
      style: 'display:block;background:#1a1a1a;border:1px solid #27272a;border-radius:12px;padding:16px 20px;text-decoration:none;color:#fafafa;margin-top:22px;'
    });
    lbpCard.innerHTML = '<div style="display:flex;align-items:center;gap:14px;justify-content:space-between;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a1a1aa;margin-bottom:4px;">In partnership with omnileadsagi.com</div>'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:2px;">Live Better Podcast</div>'
      + '<div style="font-size:13px;color:#a1a1aa;">Show + community from our partner Jaime — listen, subscribe, share.</div>'
      + '</div>'
      + '<span style="flex-shrink:0;font-size:12px;color:#f59e0b;font-weight:600;">Listen →</span>'
      + '</div>';
    lbpCard.addEventListener('click', function(){ ping(slug, 'lbp', 'click'); });

    // TERTIARY — CPS · Featured Client
    var cpsHref = trackedHref('cps', slug);
    var cpsCard = el('a', {
      href: cpsHref, target: '_blank', rel: 'noopener noreferrer',
      style: 'display:block;background:#1a1a1a;border:1px solid #27272a;border-radius:12px;padding:16px 20px;text-decoration:none;color:#fafafa;margin-top:16px;'
    });
    cpsCard.innerHTML = '<div style="display:flex;align-items:center;gap:14px;justify-content:space-between;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a1a1aa;margin-bottom:4px;">Featured client · powered by Omni AI</div>'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:2px;">CPS · Psych & Custody Evaluations</div>'
      + '<div style="font-size:13px;color:#a1a1aa;">Forensic psychology + custody evaluations across Utah. Trusted by attorneys, courts, and families.</div>'
      + '</div>'
      + '<span style="flex-shrink:0;font-size:12px;color:#f59e0b;font-weight:600;">Learn more →</span>'
      + '</div>';
    cpsCard.addEventListener('click', function(){ ping(slug, 'cps', 'click'); });

    // Container
    var section = el('section', {
      style: 'background:#0f0f0f;border-radius:16px;padding:28px 24px;margin:32px 0;border:1px solid #27272a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
    });
    var heading = el('h2', {
      style: 'color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 18px 0;'
    }, ['Featured · Sponsored by Fred Circle']);
    section.appendChild(heading);
    section.appendChild(fredCard);
    section.appendChild(shareRow('fred', slug, fredHref, 'Live with Fred Circle — sponsored dispatch from Omni AI'));
    section.appendChild(lbpCard);
    section.appendChild(shareRow('lbp', slug, lbpHref, 'Live Better Podcast — in partnership with Omni AI'));
    section.appendChild(cpsCard);
    section.appendChild(shareRow('cps', slug, cpsHref, 'CPS · Psych & Custody Evaluations — featured client of Omni AI'));
    section.appendChild(newsletterForm(slug, brand));

    host.innerHTML = '';
    host.appendChild(section);

    // Impression ping — once per render
    ping(slug, 'fred', 'view');
    ping(slug, 'lbp', 'view');
    ping(slug, 'cps', 'view');
  }

  function scan() {
    var hosts = document.querySelectorAll('[id="omni-sponsor"], [data-omni-sponsor]');
    hosts.forEach(renderInto);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // SPA support — re-render when new omni-sponsor mount points appear.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": CACHE_HEADER,
      // CORS so any client domain can pull this file.
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const dynamic = "force-dynamic";
