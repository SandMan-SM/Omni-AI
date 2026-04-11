"use client";

import { useState } from "react";

interface LeadFormProps {
  slug: string;
}

export default function LeadForm({ slug }: LeadFormProps) {
  const [fields, setFields] = useState({ name: "", phone: "", email: "" });
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
        body: JSON.stringify({ ...fields, slug }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-10 px-6 rounded-2xl border border-white/10 bg-white/[0.03]">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
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
      className="w-full max-w-md mx-auto flex flex-col gap-3"
      noValidate
    >
      <input
        type="text"
        placeholder="Your name"
        value={fields.name}
        onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 border border-white/10 bg-white/[0.05] focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.07] transition-all disabled:opacity-50"
      />
      <input
        type="tel"
        placeholder="Phone number"
        value={fields.phone}
        onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 border border-white/10 bg-white/[0.05] focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.07] transition-all disabled:opacity-50"
      />
      <input
        type="email"
        placeholder="Email address"
        value={fields.email}
        onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
        disabled={loading}
        className="w-full rounded-xl px-5 py-4 text-base text-white placeholder-gray-500 border border-white/10 bg-white/[0.05] focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.07] transition-all disabled:opacity-50"
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
