import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * Route-level 404 for /newsletter/[slug] posts.
 *
 * Same soft-404 fix as app/[slug]/not-found.tsx. Without this file, a
 * newsletter slug that doesn't exist in newsletter_posts was rendering
 * the root app/not-found.tsx with HTTP 200 — indexable as a live "Not
 * Found" page by Google and LLM retrievers.
 *
 * Placing not-found.tsx inside the route segment forces Next.js to
 * return HTTP 404 for the notFound() throw originating from
 * app/newsletter/[slug]/page.tsx. Together with the sibling
 * app/[slug]/not-found.tsx, this closes the soft-404 gap across both
 * dynamic public routes on the site.
 *
 * Copy is newsletter-specific (points back to the archive + FAQ) so
 * a reader who followed a broken email link lands on an orientation
 * that matches the surface they were trying to reach.
 */
export default function NewsletterNotFound() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6 noise-overlay">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Compass className="w-6 h-6 text-amber-300" />
        </div>
        <p className="text-amber-300 text-xs uppercase tracking-widest mb-3">
          Interlinked by Omni AI
        </p>
        <h1 className="text-2xl font-bold mb-3">Issue not found.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          We couldn&rsquo;t find this newsletter issue. It may have been moved
          or the link is broken. The full archive is one click away.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/newsletter"
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-semibold text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125"
          >
            Newsletter archive
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
          >
            Home
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
