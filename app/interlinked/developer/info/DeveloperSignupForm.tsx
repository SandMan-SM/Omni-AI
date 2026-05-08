"use client";

/**
 * DeveloperSignupForm — the conversion surface for the Interlinked
 * Developer Class landing. Three required fields (name, email,
 * phone), plus a hidden honeypot the server-side bot check reads
 * via lib/validation.isBotSubmission.
 *
 * POSTs to /api/interlinked-developer-signup which:
 *   1. Rate-limits by IP (3 per 10 min — tighter than the newsletter
 *      endpoint because this fires two Resend emails per success).
 *   2. Drops honeypot hits silently.
 *   3. Upserts into newsletter_subscriptions with subscription_tier:
 *      "developer" so the lead is funneled onto the specialized
 *      Interlinked Developer newsletter list.
 *   4. Sends a branded welcome email to the registrant with a
 *      community CTA + newsletter confirmation.
 *   5. Sends an owner-notification email to alfred@omnileadsagi.com with
 *      the full contact info (the newsletter_subscriptions row only
 *      persists email, so the owner email is the only surface the
 *      name + phone land on).
 *
 * Success state
 * -------------
 * Renders an animated confirmation card with:
 *   - "You're in" message
 *   - Community CTA → /join (the canonical Omni AI community entry)
 *   - "Check your email" callout
 * The card replaces the form via state so the user gets a clear
 * signal without a page reload (which would lose any analytics
 * context from UTM params and pixel fires).
 *
 * Error handling
 * --------------
 * Server responses distinguish rate-limit (429) from validation
 * errors (400) from server errors (500). The UI surfaces each with
 * a specific message so users know whether to retry, fix their
 * input, or wait.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  Users,
} from "lucide-react";
import Link from "next/link";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function DeveloperSignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — leave empty
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Light client-side validation — the server revalidates, but
    // catching obvious issues here saves a round-trip and surfaces
    // the error inline instead of via a toast.
    if (!name.trim()) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/interlinked-developer-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          website, // honeypot field — server drops submissions where this is non-empty
        }),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMsg(
          "Too many signups from your network right now. Please try again in a few minutes.",
        );
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setStatus("error");
        setErrorMsg(
          data.error ||
            "We couldn't save your signup. Please try again in a moment.",
        );
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(
        "Network error — please check your connection and try again.",
      );
    }
  };

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl p-10 md:p-12 border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent text-center"
      >
        <div
          className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6"
          style={{
            background:
              "linear-gradient(135deg, #a7f3d0 0%, #34d399 40%, #10b981 70%, #059669 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.45), 0 0 28px rgba(16,185,129,0.45)",
          }}
        >
          <CheckCircle2 className="w-8 h-8 text-black" />
        </div>
        <p className="text-emerald-300 text-xs uppercase tracking-widest mb-3 font-semibold">
          You&rsquo;re in
        </p>
        <h3 className="text-3xl md:text-4xl font-bold mb-4">
          Welcome to the Interlinked Developer class.
        </h3>
        <p className="text-gray-400 text-base leading-relaxed max-w-xl mx-auto mb-8">
          Check your email — your first module is on the way, and you&rsquo;re
          now subscribed to the specialized Interlinked Developer newsletter.
          Next up: jump into the community and introduce yourself.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/join"
            className="group inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold text-black shadow-[0_0_18px_rgba(168,85,247,0.45)] transition-all hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, #c084fc 0%, #a855f7 45%, #7c3aed 100%)",
            }}
          >
            <Users className="w-4 h-4" />
            Join the Community
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/interlinked"
            className="inline-flex items-center justify-center h-12 px-6 rounded-xl text-sm font-medium text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Back to Interlinked
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative rounded-3xl p-8 md:p-10 border border-purple-400/20 bg-gradient-to-br from-purple-500/[0.08] via-white/[0.02] to-transparent backdrop-blur-sm"
    >
      {/* Floating value badge — ties the form back to the $50K hero */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-bold uppercase tracking-widest shadow-[0_0_16px_rgba(251,191,36,0.5)]">
        <Sparkles className="w-3 h-3" />
        $50,000 program &middot; sponsor coverage
      </div>

      <div className="text-center mb-7">
        <h3 className="text-2xl md:text-3xl font-bold mb-2">
          Apply for sponsor coverage.
        </h3>
        <p className="text-gray-400 text-sm">
          Three fields. One click. Qualified applicants get the
          entire $50,000 covered by a sponsor.
        </p>
      </div>

      <div className="space-y-4 mb-5">
        {/* Name */}
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
            disabled={status === "submitting"}
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:bg-white/[0.10] focus:border-purple-400/50 transition-colors disabled:opacity-60"
          />
        </div>
        {/* Email */}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
            required
            disabled={status === "submitting"}
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:bg-white/[0.10] focus:border-purple-400/50 transition-colors disabled:opacity-60"
          />
        </div>
        {/* Phone */}
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            autoComplete="tel"
            required
            disabled={status === "submitting"}
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:bg-white/[0.10] focus:border-purple-400/50 transition-colors disabled:opacity-60"
          />
        </div>

        {/*
          Honeypot field. Visually hidden from real users via tailwind's
          sr-only helper + tabIndex=-1; naive spam bots fill every
          <input> in the DOM so any non-empty value here flags the
          submission server-side. aria-hidden="true" keeps it out of
          the screen-reader flow. Matches the landing-lead + demo-booking
          honeypot pattern already shipping across the site.
        */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="sr-only"
        />
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-rose-400 text-xs text-center mb-4"
            role="alert"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="group relative w-full h-14 rounded-xl text-black font-bold text-base overflow-hidden transition-all hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
        style={{
          background:
            "linear-gradient(135deg, #fff5b8 0%, #ffd700 18%, #fbbf24 40%, #ffd700 70%, #fff5b8 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 24px rgba(255,215,0,0.45)",
        }}
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {status === "submitting" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Reserving your seat…
            </>
          ) : (
            <>
              Get the $50K Class — Free
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </span>
      </button>

      <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
        By signing up you join the Interlinked Developer newsletter and the Omni
        AI operator community. Unsubscribe anytime.
      </p>
    </motion.form>
  );
}
