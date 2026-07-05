"use client";

import { useState } from "react";
import { ArrowRight, Check, Mail, CalendarClock } from "lucide-react";

/**
 * Above-the-fold conversion widget for /newsletter.
 * - Subscribe: posts a `subscribe` event to the inbound ingest (which now
 *   persists the email → inbound_omnileads_leads → federation_subscribers).
 * - Book: drives high-intent readers straight to the live strategy-call funnel.
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
        Get the daily brief — free
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
          <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-black/30 p-1.5 focus-within:border-amber-400/50">
            <Mail className="ml-2 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="your best email"
              className="w-full min-w-0 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="shrink-0 rounded-md bg-amber-400 px-3 py-2 text-xs font-bold uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {state === "sending" ? "…" : "Join free"}
            </button>
          </div>
          {state === "error" && (
            <p className="mt-2 text-xs text-rose-300">Something blocked that — try again.</p>
          )}
          <p className="mt-2 text-[11px] text-gray-500">No spam. Unsubscribe anytime.</p>
        </form>
      )}

      <div className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <a
        href="https://mythosais.com/book/free-consultation?utm_source=omni_newsletter&utm_medium=hero&utm_campaign=strategy_call"
        className="flex items-center justify-center gap-2 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-3 text-sm font-semibold text-sky-200 transition hover:border-sky-300/60 hover:bg-sky-400/15"
      >
        <CalendarClock className="h-4 w-4" />
        Book a free AI strategy call
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}
