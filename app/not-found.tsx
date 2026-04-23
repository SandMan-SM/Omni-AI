import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * 404 page. Previously this rendered a light-mode debug card that said
 * "Did you forget to add the page to the router?" — developer text that
 * shouldn't be visible to end users. Replaced with a branded dark-theme
 * fallback that offers useful escape hatches.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-6 noise-overlay">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
        <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Compass className="w-6 h-6 text-amber-300" />
        </div>
        <p className="text-amber-300 text-xs uppercase tracking-widest mb-3">Omni AI</p>
        <h1 className="text-2xl font-bold mb-3">Nothing here.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          The page you&apos;re looking for doesn&apos;t exist — or it moved.
          Try one of these instead.
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
