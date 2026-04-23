"use client";

/**
 * SiteTracker — mounted once in app/layout.tsx.
 *
 * Fires two kinds of events into the `events` table via /api/events/track:
 *   1. page_view — on first mount + every pathname / searchParams change
 *      (covers both hard navigations and soft client-side routing)
 *   2. click     — via a single delegated listener on document.body that
 *      walks up from the click target to the nearest <button>, <a>, or
 *      [data-track]/[role=button] element and records a stable label.
 *
 * Anonymous-friendly: every browser gets a persistent `omni_visitor_id`
 * (localStorage, ~permanent) and a per-tab `omni_session_id` (sessionStorage).
 * Authenticated users' ids get layered on top without losing the visitor id —
 * so we can count unique visitors and unique sessions even before signup.
 *
 * Uses navigator.sendBeacon when available so clicks on outbound links still
 * get recorded as the page unloads. Falls back to keepalive fetch.
 */

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Paths we never track (admin, API calls themselves, Next internals).
const IGNORED_PREFIXES = ["/api/", "/_next/"];

type Payload = {
  event_type: "page_view" | "click" | "form_submit";
  event_category: string;
  action: string;
  page_url?: string;
  target_type?: string;
  target_id?: string;
  value_text?: string;
  session_id?: string;
  properties?: Record<string, unknown>;
};

function randomId() {
  // 12 bytes of base36 entropy — fine for analytics, collisions negligible.
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem("omni_visitor_id");
    if (!id) {
      id = "v_" + randomId();
      localStorage.setItem("omni_visitor_id", id);
    }
    return id;
  } catch {
    return "v_" + randomId();
  }
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("omni_session_id");
    if (!id) {
      id = "s_" + randomId();
      sessionStorage.setItem("omni_session_id", id);
    }
    return id;
  } catch {
    return "s_" + randomId();
  }
}

function getAuthUserId(): string | null {
  // auth-modal + dashboard stash the Supabase user blob under omni_user in
  // localStorage. Read it if present so signed-in visits are attributed.
  try {
    const raw = localStorage.getItem("omni_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.id || null;
  } catch {
    return null;
  }
}

function send(payload: Payload, opts: { beacon?: boolean } = {}) {
  const body = {
    ...payload,
    actor_type: getAuthUserId() ? "user" : "visitor",
    actor_id: getAuthUserId() || getVisitorId(),
    session_id: payload.session_id || getSessionId(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  const url = "/api/events/track";

  // sendBeacon is best for click-then-navigate — the request survives unload.
  if (opts.beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    } catch {
      // fall through to fetch
    }
  }

  // Fire-and-forget. `keepalive: true` lets a pending request outlive a
  // same-tab navigation on most modern browsers.
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow — analytics must never break the page */
  }
}

// Walk up from the raw click target to the first trackable element.
function findTrackTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  let el: HTMLElement | null = node;
  for (let i = 0; i < 6 && el; i++) {
    if (
      el.dataset?.track ||
      el.tagName === "BUTTON" ||
      el.tagName === "A" ||
      el.getAttribute("role") === "button"
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

// Produce a stable, human-readable label for a clicked element.
function labelFor(el: HTMLElement): string {
  const ds = el.dataset?.track;
  if (ds) return ds.slice(0, 120);

  const testid = el.getAttribute("data-testid");
  if (testid) return testid.slice(0, 120);

  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 120);

  const title = el.getAttribute("title");
  if (title) return title.slice(0, 120);

  const txt = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
  if (txt) return txt.slice(0, 120);

  if (el.tagName === "A") {
    const href = (el as HTMLAnchorElement).getAttribute("href") || "";
    return `link:${href.slice(0, 120)}`;
  }

  return `${el.tagName.toLowerCase()}`;
}

export function SiteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastFiredRef = useRef<string>("");

  // ── page_view ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!pathname) return;
    if (IGNORED_PREFIXES.some(p => pathname.startsWith(p))) return;

    const qs = searchParams?.toString() || "";
    const full = qs ? `${pathname}?${qs}` : pathname;

    // Guard against strict-mode double-fire and effectively-identical routes.
    if (lastFiredRef.current === full) return;
    lastFiredRef.current = full;

    const referrer =
      typeof document !== "undefined" ? document.referrer || null : null;
    const viewport =
      typeof window !== "undefined"
        ? { w: window.innerWidth, h: window.innerHeight }
        : null;

    // Parse utm_* params into a tidy object so the DB stays queryable.
    const utm: Record<string, string> = {};
    if (searchParams) {
      searchParams.forEach((v, k) => {
        if (k.startsWith("utm_")) utm[k] = v;
      });
    }

    send({
      event_type: "page_view",
      event_category: "navigation",
      action: "view",
      page_url: full,
      properties: {
        referrer,
        viewport,
        utm: Object.keys(utm).length ? utm : undefined,
      },
    });
  }, [pathname, searchParams]);

  // ── click delegation ───────────────────────────────────────────────
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      const el = findTrackTarget(ev.target);
      if (!el) return;
      // Don't record clicks on analytics-hostile elements.
      if (el.getAttribute("aria-hidden") === "true") return;

      const label = labelFor(el);
      const href =
        el.tagName === "A" ? (el as HTMLAnchorElement).getAttribute("href") : null;
      const isOutbound = href ? /^https?:\/\//i.test(href) &&
        !href.includes(window.location.host) : false;

      send(
        {
          event_type: "click",
          event_category: "interaction",
          action: "click",
          page_url:
            window.location.pathname +
            (window.location.search ? window.location.search : ""),
          target_type: el.tagName.toLowerCase(),
          target_id: label,
          value_text: label,
          properties: {
            href: href || undefined,
            outbound: isOutbound || undefined,
            testid: el.getAttribute("data-testid") || undefined,
            class: el.className?.slice?.(0, 120) || undefined,
          },
        },
        // If it's an anchor to another page/origin, use sendBeacon so the
        // event survives the navigation.
        { beacon: !!href }
      );
    }

    // Capture form submits too — valuable signal for CTA conversions.
    function onSubmit(ev: SubmitEvent) {
      const form = ev.target as HTMLFormElement | null;
      if (!form || !(form instanceof HTMLFormElement)) return;
      const label =
        form.getAttribute("data-track") ||
        form.getAttribute("name") ||
        form.getAttribute("id") ||
        "form";
      send({
        event_type: "form_submit",
        event_category: "interaction",
        action: "submit",
        page_url:
          window.location.pathname +
          (window.location.search ? window.location.search : ""),
        target_type: "form",
        target_id: label,
        value_text: label,
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
    };
  }, []);

  return null;
}
