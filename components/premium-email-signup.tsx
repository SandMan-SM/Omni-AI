"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { grantLocalPremiumAccess } from "@/lib/premium-access";

type Status = "idle" | "loading" | "success" | "error";

export function PremiumEmailSignup({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          offer: "premium-limited-time",
          source: "newsletter-premium-info",
        }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        premium?: boolean;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "We couldn't unlock Premium. Please try again.",
        );
      }

      /*
       * The API already flipped this reader to subscription_tier "premium" and
       * says so in the response. Record that locally so the gate stops sending
       * them to the upsell, then take them straight to the issue they were
       * trying to read. Previously this only printed "Premium unlocked" and
       * left them exactly where they were, still locked out.
       */
      grantLocalPremiumAccess(trimmed);
      setEmail("");
      setStatus("success");
      setMessage("Premium unlocked. Opening your issue\u2026");

      const destination =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/newsletter/archive";
      window.location.assign(destination);
      return;
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "The request timed out. Please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      setStatus((current) => (current === "loading" ? "idle" : current));
    }
  }

  if (status === "success") {
    return (
      <div
        className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] px-5 py-4 text-sm font-medium text-emerald-100 shadow-[0_0_35px_rgba(52,211,153,0.08)]"
        role="status"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-300 text-black">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        {message}
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="group flex min-h-12 items-center gap-2 overflow-hidden rounded-xl border border-sky-300/20 bg-gradient-to-r from-slate-950/90 via-indigo-950/50 to-sky-950/40 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all focus-within:border-sky-300/65 focus-within:ring-2 focus-within:ring-sky-400/15 hover:border-white/20"
        data-testid="form-premium-limited-signup"
      >
        <label htmlFor="premium-email" className="sr-only">
          Email address
        </label>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-sky-300 transition-colors group-focus-within:border-sky-300/20 group-focus-within:bg-sky-300/10">
          <Mail className="h-4 w-4" aria-hidden="true" />
        </span>
        <input
          id="premium-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          disabled={status === "loading"}
          className="w-full min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
        />
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-cover bg-center px-3 py-2.5 text-xs font-bold uppercase tracking-[0.04em] text-white shadow-[0_0_20px_rgba(56,189,248,0.20)] [text-shadow:0_1px_5px_rgba(0,0,0,0.95)] transition hover:scale-[1.02] hover:border-sky-200/60 hover:brightness-125 disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:tracking-[0.08em]"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(15,23,42,0.5), rgba(49,46,129,0.18)), url("/images/newsletter-subscribe-bg.webp")',
          }}
        >
          {status === "loading" ? (
            "Unlocking…"
          ) : (
            <>
              Unlock<span className="hidden sm:inline"> Premium</span>
            </>
          )}
          {status !== "loading" && (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
      <p
        className={[
          "mt-3 min-h-5 text-sm",
          status === "error" ? "text-rose-300" : "text-transparent",
        ].join(" ")}
        role={status === "error" ? "alert" : undefined}
      >
        {message || "Signup status"}
      </p>
    </div>
  );
}
