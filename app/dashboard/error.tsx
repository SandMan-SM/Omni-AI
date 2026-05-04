"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for the /dashboard route segment.
 *
 * Dashboard components load user-specific Supabase data — a failed query
 * here would otherwise paint the Next.js default crash screen to a paying
 * user. This renders a branded fallback with a reset action so a flaky
 * fetch doesn't look like the whole app is broken.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[/dashboard] segment error:", error);
    // Best-effort log to hades_root_audit so silent client errors land
    // in Hades alongside privileged-action audits. Same endpoint admin
    // uses; segment is logged via the path field.
    try {
      const body = JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack?.slice(0, 4000),
        digest: error.digest,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        ts: new Date().toISOString(),
      });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/admin/log-error",
          new Blob([body], { type: "application/json" }),
        );
      } else {
        void fetch("/api/admin/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* never throw inside an error boundary */
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <h1 className="text-2xl font-bold mb-3">We hit a snag loading your dashboard.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          This is usually a transient issue — tapping retry fixes it most of
          the time. If it persists, email
          <a
            href="mailto:help@omnileadsagi.com"
            className="mx-1 text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-400/40 hover:decoration-amber-300/80"
          >
            help@omnileadsagi.com
          </a>
          and include the ref
          <code className="ml-1 px-1 rounded bg-white/[0.06] text-amber-300 text-xs">
            {error.digest || "[no digest]"}
          </code>
          .
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
