"use client";

import { useEffect, useState } from "react";
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
 *
 * For client-side errors that arrive without a Vercel digest (most React
 * runtime errors), we surface the actual error name + message + stack
 * inside a collapsible block so the operator can paste the cause back to
 * an engineer immediately. We also POST the error to /api/admin/log-error
 * (best-effort) so it lands in `hades_root_audit` for forensic review.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showStack, setShowStack] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log the raw error server-side so it shows up in Vercel logs.
    // eslint-disable-next-line no-console
    console.error("[/admin] segment error:", error);

    // Best-effort POST to the audit log so silent client errors get
    // captured for review even if the operator doesn't paste them.
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
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/admin/log-error", blob);
      } else {
        void fetch("/api/admin/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* never throw from inside an error boundary */
    }
  }, [error]);

  const detailsText = [
    `name: ${error.name}`,
    `message: ${error.message}`,
    error.digest ? `digest: ${error.digest}` : "digest: [no digest]",
    error.stack ? `\n${error.stack}` : "",
  ].join("\n");

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(detailsText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full rounded-2xl border border-amber-500/20 bg-white/[0.03] p-8 backdrop-blur-sm">
        <h1 className="text-2xl font-bold mb-3 text-center">Something broke in the admin.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6 text-center">
          The admin panel hit a client-side error. The actual cause is below —
          screenshot or paste it back so we can fix the root.
        </p>

        {/* Error message — always visible */}
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-950/30 p-4 text-left">
          <p className="font-mono text-xs text-rose-200/80 uppercase tracking-wider mb-1">
            {error.name || "Error"}
          </p>
          <p className="font-mono text-sm text-rose-100 break-words">
            {error.message || "(no message)"}
          </p>
        </div>

        {/* Stack — collapsed by default */}
        {error.stack && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowStack((v) => !v)}
              className="text-xs text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
            >
              {showStack ? "Hide stack trace" : "Show stack trace"}
            </button>
            {showStack && (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-all">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
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
          <button
            type="button"
            onClick={copyDetails}
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            {copied ? "Copied ✓" : "Copy details"}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Go home
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-500">
          digest:{" "}
          <code className="px-1 rounded bg-white/[0.06] text-amber-300/80">
            {error.digest || "[no digest]"}
          </code>
          {" "}· logged to <code>hades_root_audit</code>
        </p>
      </div>
    </div>
  );
}
