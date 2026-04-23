"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary — catches uncaught exceptions in any page segment
 * that doesn't have its own `error.tsx`. Without this file those errors
 * fall through to Next.js's bare default screen with no branding and a
 * raw stack trace.
 *
 * Segment-specific boundaries (`app/admin/error.tsx`,
 * `app/dashboard/error.tsx`, `app/newsletter/[slug]/error.tsx`) still win
 * for their segments; this just covers everything else — the marketing
 * pages, /faq, /about, /arena, etc.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the raw error server-side so it surfaces in Vercel logs.
    // eslint-disable-next-line no-console
    console.error("[root] segment error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6 noise-overlay">
      <div className="max-w-md w-full rounded-2xl border border-amber-500/20 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <p className="text-amber-300 text-xs uppercase tracking-widest mb-3">Omni AI</p>
        <h1 className="text-2xl font-bold mb-3">Something went sideways.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          The page hit an unexpected error. Retrying usually fixes it. If it
          keeps happening, drop us a note at
          <a
            href="mailto:alfred@omnileadsagi.com"
            className="mx-1 text-amber-300 hover:text-amber-200 underline underline-offset-2"
          >
            alfred@omnileadsagi.com
          </a>
          and include this code:
          <code className="mx-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-300 text-xs">
            {error.digest || "no-digest"}
          </code>
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-semibold text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
