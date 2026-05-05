"use client";

/**
 * Tracking Setup — copy-paste install snippets per client slug.
 *
 * Each client site (LTB on Shopify, Prime IV Sandy on WordPress, etc.)
 * needs a small JS snippet that POSTs page_view / click / form_submit
 * events to /api/inbound/[slug]/events. This page generates the snippet
 * for each registered slug so the operator doesn't have to assemble the
 * URL, slug, visitor-id logic by hand each time.
 *
 * Admin-only. The snippets themselves are safe to share publicly — they
 * only ingest events from origins on the CORS allowlist.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, Activity } from "lucide-react";
import { INBOUND_SLUGS, INBOUND_SLUG_LABELS, INBOUND_ORIGINS, type InboundSlug } from "@/lib/inbound-types";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

const ENDPOINT_BASE = "https://omnileadsagi.com/api/inbound";

function buildSnippet(slug: InboundSlug): string {
  return `<!-- Omni AI Inbound Tracking — ${INBOUND_SLUG_LABELS[slug]} -->
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var ENDPOINT = ${JSON.stringify(`${ENDPOINT_BASE}/${slug}/events`)};

  // Stable visitor + per-tab session ids.
  function uid(){ return Math.random().toString(36).slice(2, 14); }
  var vid = localStorage.getItem('omni_visitor_id');
  if (!vid) { vid = uid() + uid(); localStorage.setItem('omni_visitor_id', vid); }
  var sid = sessionStorage.getItem('omni_session_id');
  if (!sid) { sid = uid() + uid(); sessionStorage.setItem('omni_session_id', sid); }

  function send(payload){
    var body = JSON.stringify(Object.assign({
      visitor_id: vid, session_id: sid,
      page_url: location.href, user_agent: navigator.userAgent,
    }, payload));
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function(){});
    }
  }

  // Initial page view + soft-route changes.
  send({ event_type: 'page_view', event_category: 'navigation', action: 'view' });
  var lastPath = location.pathname + location.search;
  setInterval(function(){
    var p = location.pathname + location.search;
    if (p !== lastPath) {
      lastPath = p;
      send({ event_type: 'page_view', event_category: 'navigation', action: 'view' });
    }
  }, 800);

  // Delegated click tracking — captures every <a>, <button>, [data-track].
  document.addEventListener('click', function(ev){
    var el = ev.target;
    while (el && el !== document.body) {
      if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.hasAttribute('data-track') || el.getAttribute('role') === 'button') break;
      el = el.parentElement;
    }
    if (!el || el === document.body) return;
    var label = el.getAttribute('data-track') || el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 60);
    send({
      event_type: 'click', event_category: 'interaction', action: 'click',
      target_type: el.tagName.toLowerCase(),
      target_id: el.id || label,
      value_text: label,
      properties: {
        href: el.getAttribute('href') || null,
        area: el.closest('[data-track-area]')?.getAttribute('data-track-area') || null,
      },
    });
  }, { capture: true });

  // Form submits.
  document.addEventListener('submit', function(ev){
    var form = ev.target;
    if (!form || form.tagName !== 'FORM') return;
    send({
      event_type: 'form_submit', event_category: 'conversion', action: 'submit',
      target_type: 'form',
      target_id: form.id || form.getAttribute('name') || form.action || 'form',
    });
  }, { capture: true });
})();
</script>`;
}

export default function TrackingSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, profileLoading } = useProfile();
  const [copied, setCopied] = useState<InboundSlug | null>(null);
  const [active, setActive] = useState<InboundSlug>("ltb");

  // Admin-only — same gate as /admin and /admin/interlinked. Non-admins are
  // redirected back to their dashboard. Loading state shows nothing to avoid
  // flashing the snippet to a user who shouldn't see it.
  useEffect(() => { if (!authLoading && !user) router.push("/"); }, [user, authLoading, router]);
  useEffect(() => {
    if (!profileLoading && (!isAdmin)) router.push("/dashboard");
  }, [profileLoading, isAdmin, router]);

  async function copy(slug: InboundSlug) {
    try {
      await navigator.clipboard.writeText(buildSnippet(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  if (authLoading || profileLoading || !user || !isAdmin) return null;

  const allowed = INBOUND_ORIGINS[active] ?? [];

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e8e8e8", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/admin" style={{ color: "#666", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}>
            <ArrowLeft size={14} /> Admin
          </Link>
          <div style={{ width: 1, height: 20, background: "#222" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={14} color="#10b981" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Tracking Setup</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Install the inbound tracker</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
          Paste the snippet below into the <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>&lt;head&gt;</code> of each client&rsquo;s
          website (or before the closing <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>&lt;/body&gt;</code>). It captures
          page views, clicks, and form submits and ships them to the matching agentic dashboard. Origins outside the allowlist are blocked at CORS.
        </p>

        {/* Slug picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {INBOUND_SLUGS.map((s) => {
            const isActive = active === s;
            return (
              <button
                key={s}
                onClick={() => setActive(s)}
                style={{
                  background: isActive ? "#0d2a1e" : "#111",
                  border: `1px solid ${isActive ? "#10b981" : "#1e1e1e"}`,
                  color: isActive ? "#10b981" : "#94a3b8",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {INBOUND_SLUG_LABELS[s]}
              </button>
            );
          })}
        </div>

        {/* Endpoint + origins */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>Endpoint</div>
            <code style={{ fontSize: 13, color: "#10b981", wordBreak: "break-all" }}>{ENDPOINT_BASE}/{active}/events</code>
          </div>
          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>Allowed origins ({allowed.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {allowed.map((o) => (
                <code key={o} style={{ fontSize: 12, color: "#94a3b8" }}>{o}</code>
              ))}
            </div>
          </div>
        </div>

        {/* Snippet */}
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1e1e1e" }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{INBOUND_SLUG_LABELS[active]} install snippet</span>
            <button
              onClick={() => copy(active)}
              style={{
                background: copied === active ? "#0d2a1e" : "#191919",
                border: `1px solid ${copied === active ? "#10b981" : "#1e1e1e"}`,
                color: copied === active ? "#10b981" : "#94a3b8",
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {copied === active ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <pre style={{ margin: 0, padding: 18, overflow: "auto", fontSize: 11, color: "#cbd5e1", lineHeight: 1.6, fontFamily: "Menlo, Monaco, monospace" }}>
            {buildSnippet(active)}
          </pre>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: "#0d1f2a", border: "1px solid #38bdf840", borderRadius: 10, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
          <strong style={{ color: "#38bdf8" }}>Verification:</strong> after installing, load any page on the client&rsquo;s site, then refresh
          their workspace dashboard&rsquo;s <em>Site Analytics</em> tab. The visitor count and live event stream should update within ~30 seconds.
          To add a new allowed origin (e.g. a staging URL), edit <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>lib/inbound-types.ts</code> and redeploy.
        </div>
      </div>
    </div>
  );
}
