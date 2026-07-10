"use client";

import { useEffect, useRef, useState } from "react";

// Ellie Talks × Omni AI — $4,000/month growth partnership.
// PayPal live subscription plan (Omni AI PayPal account).
const CLIENT_ID =
  "AW72P6A-yKEg77Tkh866rDoce2DKYU2EUhGKQp-401eIFKpSERKCOETvqtcSYTVTN4rnFbvBt6vP6Lf4";
const PLAN_ID = "P-1TG9765750046684LNJIUZWY";
const SDK_ID = "paypal-sdk-elitalks-subscription";

type Paypal = {
  Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => void };
};

export function PayPalSubscribeButton() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    function render() {
      const paypal = (window as unknown as { paypal?: Paypal }).paypal;
      if (!paypal || !ref.current || cancelled) return;
      ref.current.innerHTML = "";
      try {
        paypal
          .Buttons({
            style: { layout: "vertical", color: "gold", shape: "pill", label: "subscribe" },
            createSubscription: (_data: unknown, actions: { subscription: { create: (o: { plan_id: string }) => Promise<string> } }) =>
              actions.subscription.create({ plan_id: PLAN_ID }),
            onApprove: () => setStatus("done"),
            onError: () => setStatus("error"),
          })
          .render(ref.current);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }

    if ((window as unknown as { paypal?: Paypal }).paypal) {
      render();
      return;
    }
    let s = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SDK_ID;
      s.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription`;
      s.onload = render;
      s.onerror = () => setStatus("error");
      document.body.appendChild(s);
    } else {
      s.addEventListener("load", render);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-5 text-sm text-emerald-200">
        You&apos;re in — subscription started. We&apos;ll reach out to kick off the build.
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div ref={ref} className="min-h-[52px]" />
      {status === "error" && (
        <p className="mt-2 text-xs text-zinc-400">
          Payment couldn&apos;t load here — email{" "}
          <span className="text-amber-300">hello@omnileadsagi.com</span> and we&apos;ll send a direct link.
        </p>
      )}
    </div>
  );
}
