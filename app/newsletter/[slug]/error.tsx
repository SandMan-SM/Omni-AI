"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for /newsletter/[slug] posts.
 *
 * Newsletter posts are public and indexed by Google + LLMs. A failure
 * here (e.g., a post row that fails to render due to a bad jsonb shape)
 * would otherwise show the Next.js default crash screen to a reader
 * following a link from an email or social share. This renders a
 * branded fallback with a link back to the newsletter archive so the
 * reader stays on the site.
 */
export default function NewsletterPostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[/newsletter/[slug]] segment error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
          Interlinked by Omni AI
        </p>
        <h1 className="text-2xl font-bold mb-3">We couldn&rsquo;t load this issue.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Something went wrong rendering the post. Try again, or jump back to
          the archive to find what you were looking for.
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
            href="/newsletter"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Newsletter archive
          </Link>
        </div>
      </div>
    </div>
  );
}
