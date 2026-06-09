"use client";

// PayPalSubscribeButton — renders a PayPal Smart Subscription button
// for a fixed billing plan. Loads the PayPal JS SDK once (singleton),
// then renders a subscription button into its own container. On
// approval it flips to a success state; PayPal handles the recurring
// billing from there.
//
// clientId is the PayPal app's public Client ID (safe in the browser —
// the SDK puts it in the script URL). planId is the billing plan
// created via the PayPal Subscriptions API. If either is missing the
// component renders nothing (graceful no-op — e.g. if the prod env var
// isn't set yet), so the page never shows a broken button.

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => {
        render: (el: HTMLElement) => void;
      };
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadPaypalSdk(clientId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      "https://www.paypal.com/sdk/js?client-id=" +
      encodeURIComponent(clientId) +
      "&vault=true&intent=subscription";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("PayPal SDK failed to load"));
    };
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export function PayPalSubscribeButton({
  clientId,
  planId,
  className = "",
}: {
  clientId: string;
  planId: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId || !planId || !ref.current) return;
    let cancelled = false;
    loadPaypalSdk(clientId)
      .then(() => {
        if (cancelled || !ref.current || !window.paypal) return;
        // Clear any prior render (StrictMode double-invoke guard).
        ref.current.innerHTML = "";
        window.paypal
          .Buttons({
            style: {
              layout: "vertical",
              color: "gold",
              shape: "pill",
              label: "subscribe",
            },
            createSubscription: (
              _data: unknown,
              actions: { subscription: { create: (o: { plan_id: string }) => Promise<string> } },
            ) => actions.subscription.create({ plan_id: planId }),
            onApprove: () => setDone(true),
            onError: () => setFailed(true),
          })
          .render(ref.current);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, planId]);

  // Missing config → render nothing (no broken button on the page).
  if (!clientId || !planId) return null;

  if (done) {
    return (
      <p className={"text-sm text-emerald-300 leading-relaxed " + className}>
        Subscription started — we&apos;ll reach out within one business
        day to kick off the program.
      </p>
    );
  }

  return (
    <div className={className}>
      <div ref={ref} />
      {failed && (
        <p className="mt-2 text-xs text-zinc-500">
          PayPal couldn&apos;t load — use the Stripe option above, or text
          Sitani at (385) 563-1562.
        </p>
      )}
    </div>
  );
}
