"use client";

// PayPalOrderButton — renders a PayPal Smart Button for a ONE-TIME
// payment of a fixed amount (intent=capture). Companion to
// PayPalSubscribeButton (which is intent=subscription).
//
// Why a separate SDK load: the PayPal JS SDK can only carry one
// `intent` per script tag. The subscribe button loads the default
// instance with `vault=true&intent=subscription` (window.paypal). To
// run one-time buttons on the SAME page we load a SECOND instance under
// a distinct `data-namespace="paypalOrder"` (window.paypalOrder) with
// `intent=capture`. This is the documented multi-config approach and is
// what lets /solutions show both subscribe + buy buttons together.
//
// clientId is the public PayPal Client ID (browser-safe). amount is a
// USD string ("25000"). If clientId or amount is missing the component
// renders nothing (graceful no-op) so the page never shows a broken
// button. Capture is client-side, matching PayPalSubscribeButton's
// trust level; server-side webhook verification is future hardening.

import { useEffect, useRef, useState } from "react";

type PayPalNS = {
  Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => void };
  FUNDING: { CARD: string; PAYPAL: string };
};

declare global {
  interface Window {
    paypalOrder?: PayPalNS;
  }
}

let orderSdkPromise: Promise<void> | null = null;

function loadPaypalOrderSdk(clientId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.paypalOrder) return Promise.resolve();
  if (orderSdkPromise) return orderSdkPromise;
  orderSdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      "https://www.paypal.com/sdk/js?client-id=" +
      encodeURIComponent(clientId) +
      "&intent=capture&currency=USD";
    s.async = true;
    s.setAttribute("data-namespace", "paypalOrder");
    s.onload = () => resolve();
    s.onerror = () => {
      orderSdkPromise = null;
      reject(new Error("PayPal SDK (order) failed to load"));
    };
    document.body.appendChild(s);
  });
  return orderSdkPromise;
}

export function PayPalOrderButton({
  clientId,
  amount,
  label,
  className = "",
  funding = "card",
}: {
  clientId: string;
  amount: string;
  label?: string;
  className?: string;
  // "card" → standalone Debit/Credit Card button (inline card form).
  // "paypal" → yellow PayPal button that opens the actual PayPal page.
  funding?: "card" | "paypal";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId || !amount || !ref.current) return;
    let cancelled = false;
    loadPaypalOrderSdk(clientId)
      .then(() => {
        if (cancelled || !ref.current || !window.paypalOrder) return;
        ref.current.innerHTML = ""; // StrictMode double-invoke guard
        window.paypalOrder
          .Buttons({
            // "card" → standalone Debit/Credit Card button (inline form).
            // "paypal" → yellow PayPal button → opens the real PayPal page.
            fundingSource:
              funding === "paypal"
                ? window.paypalOrder.FUNDING.PAYPAL
                : window.paypalOrder.FUNDING.CARD,
            style: { shape: "pill" },
            createOrder: (
              _data: unknown,
              actions: {
                order: {
                  create: (o: Record<string, unknown>) => Promise<string>;
                };
              },
            ) =>
              actions.order.create({
                purchase_units: [
                  {
                    amount: { value: amount, currency_code: "USD" },
                    description: label || "Omni AI service",
                  },
                ],
              }),
            onApprove: (
              _data: unknown,
              actions: { order: { capture: () => Promise<unknown> } },
            ) => actions.order.capture().then(() => setDone(true)),
            onError: () => setFailed(true),
          })
          .render(ref.current);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, amount, label, funding]);

  if (!clientId || !amount) return null;

  if (done) {
    return (
      <p className={"text-sm text-emerald-300 leading-relaxed " + className}>
        Payment received — we&apos;ll reach out within one business day to
        kick things off.
      </p>
    );
  }

  return (
    <div className={className}>
      <div ref={ref} />
      {!failed && (
        // "Powered by PayPal" caption — the standalone card button doesn't
        // render one, so we add it to match the subscribe widget's caption
        // on the monthly cards (consistent across every card).
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
          Powered by
          <span className="font-bold">
            <span style={{ color: "#003087" }}>Pay</span>
            <span style={{ color: "#009cde" }}>Pal</span>
          </span>
        </p>
      )}
      {failed && (
        <p className="mt-2 text-xs text-zinc-500">
          PayPal couldn&apos;t load — text Sitani at (385) 563-1562 to start.
        </p>
      )}
    </div>
  );
}
