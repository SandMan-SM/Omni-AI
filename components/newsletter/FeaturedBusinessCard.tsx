// iMessage-style rich-link preview card that swaps the generic
// Schedule-a-Meeting CTA on a free shoutout post. Goal: read like a text
// someone forwarded, with the offer pulling the click.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Shoutout } from "@/lib/newsletter-shoutouts";

const ACCENT: Record<NonNullable<Shoutout["accent"]>, { ring: string; chip: string; text: string; glow: string }> = {
  amber:   { ring: "border-amber-500/40",   chip: "bg-amber-500/15 text-amber-300 border-amber-500/30",     text: "text-amber-300",   glow: "shadow-[0_0_24px_rgba(251,191,36,0.18)]" },
  blue:    { ring: "border-blue-500/40",    chip: "bg-blue-500/15 text-blue-300 border-blue-500/30",        text: "text-blue-300",    glow: "shadow-[0_0_24px_rgba(59,130,246,0.20)]" },
  emerald: { ring: "border-emerald-500/40", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", text: "text-emerald-300", glow: "shadow-[0_0_24px_rgba(16,185,129,0.20)]" },
  rose:    { ring: "border-rose-500/40",    chip: "bg-rose-500/15 text-rose-300 border-rose-500/30",        text: "text-rose-300",    glow: "shadow-[0_0_24px_rgba(244,63,94,0.20)]" },
};

export function FeaturedBusinessCard({ shoutout }: { shoutout: Shoutout }) {
  const a = ACCENT[shoutout.accent ?? "amber"];
  return (
    <div className="mb-10">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
        Featured this week
      </p>
      <Link
        href={shoutout.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group block rounded-2xl border ${a.ring} bg-white/[0.04] backdrop-blur-sm overflow-hidden transition-all hover:bg-white/[0.06] hover:scale-[1.005] ${a.glow}`}
        data-testid="featured-business-card"
      >
        {/* Optional hero image — only renders if a shoutout supplies one */}
        {shoutout.image && (
          <div className="relative w-full aspect-[1200/630] bg-black/30 border-b border-white/5">
            {/* Plain <img> not next/image — shoutout images are tiny one-offs and
                next/image needs a domain allowlist that would couple this card
                to next.config.js for every new shoutout */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shoutout.image} alt={shoutout.imageAlt ?? shoutout.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 truncate">{shoutout.host}</p>
            <ArrowUpRight className={`w-4 h-4 ${a.text} flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-white leading-snug mb-2">
            {shoutout.name}
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            {shoutout.description}
          </p>
          {shoutout.offer && (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-semibold ${a.chip}`}>
              {shoutout.offer}
            </span>
          )}
        </div>
      </Link>
      <p className="text-[11px] text-gray-600 mt-2 text-center">
        Sponsored shoutout · click to open {shoutout.host}
      </p>
    </div>
  );
}
