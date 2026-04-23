import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * Route-level 404 for /[slug] daily landing pages.
 *
 * Why this file exists
 * --------------------
 * Without a route-segment not-found.tsx, Next.js 14.2's behavior on the
 * /[slug] dynamic catch-all was to render the root app/not-found.tsx but
 * return HTTP 200 instead of 404 — a classic "soft 404" that Google flags
 * as a crawl-quality issue and LLM retrievers can index as a live page.
 *
 * Confirmed bug state before this fix (curl -sI):
 *   /this-slug-definitely-does-not-exist-abc123  → HTTP 200
 *   /just-not-valid-path                         → HTTP 200
 *   /sitemap_index.xml                           → HTTP 200
 *
 * A route-segment not-found.tsx placed inside the /[slug] folder tells
 * Next.js's renderer to treat the notFound() throw from
 * app/[slug]/page.tsx as a terminal 404 for this segment, not a fallback
 * to the root not-found boundary. The returned status is then 404, which
 * is what Google/Bing/AI crawlers need to drop the URL from the index.
 *
 * Impact
 * ------
 * /[slug] is the site's highest-traffic surface (daily Blotato-tweeted
 * landings) so the soft-404 was specifically poisoning the most
 * crawl-sensitive namespace. Every AI-hallucinated URL, typo'd tweet
 * link, and stale reference was being indexed as a thin "Not Found"
 * page — enough of those and Google downranks the whole /[slug]
 * pattern as low-quality. Ships the correct 404 status on every
 * non-match.
 *
 * Visual treatment matches app/not-found.tsx (shared brand language)
 * so the user-visible experience is identical whether they hit a 404
 * from the root or inside the /[slug] segment.
 */
export default function SlugNotFound() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6 noise-overlay">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Compass className="w-6 h-6 text-amber-300" />
        </div>
        <p className="text-amber-300 text-xs uppercase tracking-widest mb-3">
          Omni AI
        </p>
        <h1 className="text-2xl font-bold mb-3">Trending topic not found.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          This daily landing page doesn&rsquo;t exist or has moved.
          Try today&rsquo;s trending topic instead, or jump straight
          into the newsletter archive.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-semibold text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125"
          >
            Home
          </Link>
          <Link
            href="/newsletter"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Newsletter
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
