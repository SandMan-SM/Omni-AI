"use client";

import { useState } from "react";

interface LeadFormProps {
  slug: string;
}

export default function LeadForm({ slug }: LeadFormProps) {
  const [fields, setFields] = useState({ name: "", phone: "", email: "" });
  // Honeypot field — rendered off-screen with CSS + aria-hidden + tabIndex=-1.
  // Real users never see or focus it; most spambots fill every field they
  // find. Any non-empty value on submit = bot → the server silently 200s.
  // Intentionally NOT `<input type="hidden">` because bots specifically
  // skip hidden inputs now; a visible-to-the-DOM-but-hidden-from-humans
  // input is what still catches them.
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fields.name.trim() || !fields.phone.trim() || !fields.email.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/landing-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, slug, website }),
      });
      if (!res.ok) {
        // Surface the server's error message when it gave us one.
        // Previously we threw a generic "Submission failed" and caught
        // it into "Something went wrong. Please try again." — which
        // hides useful signals like "Please enter a valid email
        // address." or "Too many requests, try again in 9 minutes."
        // Both the rate-limiter and the server-side email validator
        // return a JSON `error` field; read it when present.
        let serverMsg = "";
        try {
          const payload = await res.json();
          if (payload && typeof payload.error === "string") {
            serverMsg = payload.error;
          }
        } catch {
          /* non-JSON body (Vercel 504, 502, etc.) — fall through to generic */
        }
        throw new Error(serverMsg || "Submission failed");
      }
      setSubmitted(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg && msg !== "Submission failed"
          ? msg
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-10 px-6 rounded-2xl border border-white/10 bg-white/[0.03]">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #6366f1, #ec4899)" }}
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">You&apos;re in.</h3>
        <p className="text-gray-400 leading-relaxed">
          We got your info and we&apos;re already excited. Expect to hear from us very soon — we look forward to working with you.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto flex flex-col gap-4"
      noValidate
    >
      {/* Honeypot — visually off-screen, aria-hidden, non-tabbable.
          Real users never see it; spambots that auto-fill every input
          get silently 200'd by the server. Positioned absolute with
          clip so it contributes zero space in the flex column. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor="website">Website (leave blank)</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <input
        type="text"
        name="name"
        autoComplete="name"
        aria-label="Your name"
        placeholder="Your name"
        value={fields.name}
        onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 border border-white/10 bg-white/[0.08] focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.12] transition-all disabled:opacity-50"
      />
      <input
        type="tel"
        name="phone"
        autoComplete="tel"
        aria-label="Phone number"
        placeholder="Phone number"
        value={fields.phone}
        onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 border border-white/10 bg-white/[0.08] focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.12] transition-all disabled:opacity-50"
      />
      <input
        type="email"
        name="email"
        autoComplete="email"
        aria-label="Email address"
        placeholder="Email address"
        value={fields.email}
        onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 border border-white/10 bg-white/[0.08] focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.12] transition-all disabled:opacity-50"
      />

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
        style={{
          background: loading
            ? "rgba(99,102,241,0.5)"
            : "linear-gradient(135deg, #6366f1, #ec4899)",
          boxShadow: loading ? "none" : "0 0 32px rgba(99,102,241,0.4)",
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Sending...
          </span>
        ) : (
          "Next →"
        )}
      </button>
    </form>
  );
}
