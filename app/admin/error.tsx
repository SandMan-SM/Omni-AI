"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for the /admin route segment.
 *
 * Without this file, any uncaught exception inside an admin page component
 * (a failed Supabase query, a bad-shape row mapping, etc.) bubbles up to
 * Next.js's default error screen — which shows a blank page and exposes
 * the stack trace to anyone who opens the admin URL. A per-segment
 * boundary lets us render a branded fallback and give the operator a
 * reset button instead of a crash.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the raw error server-side so it shows up in Vercel logs.
    // eslint-disable-next-line no-console
    console.error("[/admin] segment error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-500/20 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <h1 className="text-2xl font-bold mb-3">Something broke in the admin.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          The admin panel hit an unexpected error. Retrying usually fixes it.
          If it keeps happening, check the Vercel logs for the
          <code className="mx-1 px-1 rounded bg-white/[0.06] text-amber-300 text-xs">
            {error.digest || "[no digest]"}
          </code>
          digest.
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
