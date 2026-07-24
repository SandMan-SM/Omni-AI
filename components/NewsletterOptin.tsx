"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";

/**
 * Above-the-fold conversion widget for /newsletter.
 * - Subscribe: posts a `subscribe` event to the inbound ingest (which now
 *   persists the email → inbound_omnileads_leads → federation_subscribers).
 */
export default function NewsletterOptin() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email) return;
    setState("sending");
    try {
      const res = await fetch("/api/inbound/omnileads/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "form_submit",
          event_category: "subscribe",
          value_text: email,
          properties: { email, source: "newsletter_hero", list: "omnileads" },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("ok");
      form.reset();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.06] to-white/[0.02] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">
        Premium Membership — Free
      </p>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        AI trends and operator signals, decoded and sent daily. Join before the market catches up.
      </p>

      {state === "ok" ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-sm font-semibold text-emerald-200">
          <Check className="h-4 w-4" /> You&apos;re in. First brief lands next cycle.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4">
          <div className="group flex min-h-12 items-center gap-2 overflow-hidden rounded-xl border border-sky-300/20 bg-gradient-to-r from-slate-950/90 via-indigo-950/50 to-sky-950/40 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.22)] transition-all focus-within:border-sky-300/65 focus-within:ring-2 focus-within:ring-sky-400/15 hover:border-white/20">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-sky-300 transition-colors group-focus-within:border-sky-300/20 group-focus-within:bg-sky-300/10">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              aria-label="Email address"
              className="w-full min-w-0 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="shrink-0 rounded-lg border border-white/20 bg-cover bg-center px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-white shadow-[0_0_20px_rgba(56,189,248,0.20)] [text-shadow:0_1px_5px_rgba(0,0,0,0.95)] transition hover:scale-[1.02] hover:border-sky-200/60 hover:brightness-125 disabled:opacity-60"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, rgba(15,23,42,0.5), rgba(49,46,129,0.18)), url("/images/newsletter-subscribe-bg.webp")',
              }}
            >
              {state === "sending" ? "…" : "Subscribe"}
            </button>
          </div>
          {state === "error" && (
            <p className="mt-2 text-xs text-rose-300">Something blocked that — try again.</p>
          )}
        </form>
      )}

    </div>
  );
}
