/**
 * Reusable Google Analytics 4 component.
 *
 * Drop into any Next.js App-Router site's <body> at the bottom of
 * `app/layout.tsx`:
 *
 *     <GoogleAnalytics measurementId="G-XXXXXXXX" />
 *
 * Renders the standard gtag bootstrap as two <Script> tags with
 * strategy="afterInteractive" so the main page render isn't blocked.
 * The component also bridges any global `trackEvent()` calls on the
 * page into gtag — so first-party events (the ones that already write
 * to inbound_<slug>_events) automatically become GA4 events too,
 * using the canonical GA4 event names (`generate_lead`, `sign_up`,
 * `select_content`, `contact`, …).
 *
 * Safe to mount when `measurementId` is null/undefined: the component
 * short-circuits and renders nothing. That keeps every tenant repo's
 * layout identical — the only per-site difference is the env var.
 *
 * Recommended install pattern in a tenant repo:
 *
 *     // app/layout.tsx
 *     import { GoogleAnalytics } from "@/components/analytics/google-analytics";
 *     ...
 *     <body>
 *       {children}
 *       <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA4_ID} />
 *     </body>
 *
 *     // .env.production
 *     NEXT_PUBLIC_GA4_ID=G-XXXXXXXX
 *
 * For tenants whose tracker is the federation's <InboundTracker />,
 * the event-name mapping below is what gets fanned out into gtag:
 *
 *   offer_claim       → generate_lead
 *   newsletter_signup → sign_up
 *   form_submit       → generate_lead
 *   cta_click         → select_content
 *   sponsor_click     → select_content
 *   phone_click       → contact
 *   booking_completed → generate_lead
 *
 * Anything not in the map passes through with its original name —
 * GA4 accepts arbitrary event names, but custom ones don't get the
 * built-in audience signals the canonical ones do.
 */

"use client";

import Script from "next/script";
import { useEffect } from "react";

const GA4_EVENT_MAP: Record<string, string> = {
  offer_claim: "generate_lead",
  newsletter_signup: "sign_up",
  form_submit: "generate_lead",
  cta_click: "select_content",
  sponsor_click: "select_content",
  phone_click: "contact",
  booking_completed: "generate_lead",
  cart_add: "add_to_cart",
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /**
     * Federation trackEvent hook. Tenant sites that mount
     * <InboundTracker /> dispatch a custom event named "omni:track"
     * on window when an event is sent server-side. The bridge
     * useEffect below listens for it and replays into gtag.
     */
    omniGA4Bridge?: boolean;
  }
}

export interface GoogleAnalyticsProps {
  /**
   * GA4 measurement ID (e.g. "G-6JZP5C4NMQ"). When null or undefined
   * the component renders nothing — safe to leave mounted in every
   * tenant's layout and only flip on by setting the env var.
   */
  measurementId?: string | null;
  /**
   * Optional override for the "send_page_view" flag on the initial
   * config() call. Defaults to true. Disable if the tenant's
   * <InboundTracker /> already pushes its own page_view events into
   * gtag — avoids double-counting.
   */
  sendPageView?: boolean;
}

export function GoogleAnalytics({
  measurementId,
  sendPageView = true,
}: GoogleAnalyticsProps) {
  // Bridge any `window.dispatchEvent(new CustomEvent('omni:track',
  // { detail: { event_type, ...payload } }))` calls into gtag. Lets
  // the existing federation tracker stay the single source of truth
  // for emitting events — GA4 just reflects what's already going to
  // Supabase. No-op when GA4 isn't configured.
  useEffect(() => {
    if (!measurementId) return;
    if (typeof window === "undefined") return;
    if (window.omniGA4Bridge) return; // idempotent across remounts
    window.omniGA4Bridge = true;
    const onTrack = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { event_type?: string; [k: string]: unknown }
        | undefined;
      if (!detail || typeof detail.event_type !== "string") return;
      if (typeof window.gtag !== "function") return;
      const mapped = GA4_EVENT_MAP[detail.event_type] ?? detail.event_type;
      // Strip event_type from the payload so we don't double-send it
      // — GA4 uses the first argument as the event name.
      const { event_type: _ignored, ...rest } = detail;
      window.gtag("event", mapped, rest);
    };
    window.addEventListener("omni:track", onTrack);
    return () => {
      window.removeEventListener("omni:track", onTrack);
      window.omniGA4Bridge = false;
    };
  }, [measurementId]);

  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-bootstrap" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: ${sendPageView} });
        `}
      </Script>
    </>
  );
}
