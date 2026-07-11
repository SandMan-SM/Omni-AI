"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ShieldCheck, X } from "lucide-react";

/*
 * Ellie Talks x Omni AI checkout — $2,000 down, ONE-TIME PayPal payment.
 * Modeled on the sitanimafi.live intro-offer checkout: a styled CTA button
 * that opens a cosmic modal with the PayPal button inside.
 */
const PAYPAL_CLIENT_ID =
  "AW72P6A-yKEg77Tkh866rDoce2DKYU2EUhGKQp-401eIFKpSERKCOETvqtcSYTVTN4rnFbvBt6vP6Lf4";
const AMOUNT = "2000.00";
const PAYPAL_SCRIPT_ID = "paypal-elitalks-order-sdk";

const MODAL_STARS = Array.from({ length: 100 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 7) % 100}%`,
  top: `${(index * 53 + 13) % 100}%`,
  size: index % 13 === 0 ? 2.5 : index % 5 === 0 ? 1.6 : 1,
  opacity: 0.26 + ((index * 19) % 56) / 100,
  color:
    index % 11 === 0
      ? "rgba(244,194,120,0.95)"
      : index % 17 === 0
        ? "rgba(244,114,182,0.9)"
        : "rgba(255,255,255,0.92)",
}));

type PayPalOrderActions = {
  order: {
    create: (input: Record<string, unknown>) => Promise<string>;
    capture: () => Promise<unknown>;
  };
};
type PayPalButtons = { render: (selector: string) => Promise<void> };
type PayPalNamespace = {
  Buttons: (options: {
    style: { layout: "vertical"; color: "gold"; shape: "pill"; label: "pay" };
    createOrder: (data: unknown, actions: PayPalOrderActions) => Promise<string>;
    onApprove: (data: unknown, actions: PayPalOrderActions) => Promise<void> | void;
  }) => PayPalButtons;
};

function getPaypal(): PayPalNamespace | undefined {
  return (window as unknown as { paypal?: PayPalNamespace }).paypal;
}

let paypalScriptPromise: Promise<void> | null = null;
function loadPayPalScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (getPaypal()) return Promise.resolve();
  if (paypalScriptPromise) return paypalScriptPromise;
  paypalScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(PAYPAL_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = PAYPAL_SCRIPT_ID;
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal checkout failed to load."));
    document.head.appendChild(script);
  });
  return paypalScriptPromise;
}

type Props = { label: string; className: string; showArrow?: boolean };

export default function EliTalksPayPalCheckout({ label, className, showArrow = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paypalRendered = useRef(false);
  const reactId = useId().replace(/:/g, "");
  const containerId = `pp-elitalks-${reactId}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || paypalRendered.current) return;
    let cancelled = false;
    loadPayPalScript()
      .then(() => {
        if (cancelled) return;
        const pp = getPaypal();
        const container = document.getElementById(containerId);
        if (!pp || !container) throw new Error("not ready");
        container.innerHTML = "";
        return pp
          .Buttons({
            style: { layout: "vertical", color: "gold", shape: "pill", label: "pay" },
            createOrder: (_d, actions) =>
              actions.order.create({
                intent: "CAPTURE",
                purchase_units: [
                  {
                    amount: { value: AMOUNT, currency_code: "USD" },
                    description: "Ellie Talks x Omni AI — $2,000 down (one-time)",
                  },
                ],
              }),
            onApprove: (_d, actions) =>
              actions.order.capture().then(() => {
                setError(null);
                setIsOpen(false);
                window.alert(
                  "Payment received — thank you! We'll reach out to kick off your Ellie Talks partnership.",
                );
              }),
          })
          .render(`#${containerId}`);
      })
      .then(() => {
        if (!cancelled) paypalRendered.current = true;
      })
      .catch(() => {
        if (!cancelled) setError("PayPal checkout could not load. Refresh and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, containerId]);

  function open() {
    paypalRendered.current = false;
    setError(null);
    setIsOpen(true);
  }

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {label}
        {showArrow && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />}
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] grid place-items-center overflow-hidden p-4 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="elitalks-paypal-title"
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 18% 24%, rgba(244,194,120,0.20), transparent 34%), radial-gradient(circle at 82% 18%, rgba(244,114,182,0.24), transparent 36%), radial-gradient(circle at 52% 78%, rgba(139,92,246,0.14), transparent 42%), linear-gradient(180deg, rgba(10,6,18,1), rgba(5,4,10,1))",
              }}
              aria-hidden
            />
            <div className="absolute inset-0" aria-hidden>
              {MODAL_STARS.map((star) => (
                <span
                  key={star.id}
                  className="absolute rounded-full"
                  style={{
                    left: star.left,
                    top: star.top,
                    width: star.size,
                    height: star.size,
                    opacity: star.opacity,
                    backgroundColor: star.color,
                    boxShadow: "0 0 10px rgba(244,194,120,0.55)",
                  }}
                />
              ))}
            </div>
            <div className="relative w-[min(94vw,30rem)] rounded-[1.5rem] border border-amber-300/30 bg-[#0a0612] p-6 shadow-[0_30px_140px_rgba(0,0,0,0.86)]">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-transparent text-white/65"
                aria-label="Close PayPal checkout"
              >
                <X size={22} aria-hidden />
              </button>

              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
                Secure checkout
              </p>
              <h3
                id="elitalks-paypal-title"
                className="mt-3 text-4xl leading-tight text-white"
                style={{ fontFamily: "Georgia, serif" }}
              >
                $2,000 down
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                A one-time $2,000 down payment to lock in your start with Omni AI
                and kick off the Ellie Talks build.
              </p>

              <div className="mt-6 rounded-2xl border border-white/15 bg-white p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                <div id={containerId} />
                {error && <p className="mt-3 text-sm text-amber-400">{error}</p>}
              </div>

              <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-5 text-zinc-400">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                256-BIT AES Advanced Encryption
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
