import type { Metadata } from "next";
import Link from "next/link";
import { PARTNER_NETWORK } from "@/lib/partner-network";

/**
 * Omni Partner Network — the partnership's public face.
 *
 * Every embed banner across the portfolio carries a micro-label that
 * links here, and every member business can point prospects and social
 * followers at this page as proof of the network they belong to. Keep
 * the prose factual and quotable: this page is what "we have this
 * partnership" resolves to when someone checks.
 */

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/network`;

const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(
  "Omni Partner Network"
)}&topic=${encodeURIComponent(
  `${PARTNER_NETWORK.length} businesses, one growth engine`
)}&eyebrow=${encodeURIComponent("Omni AI · Network")}`;

export const metadata: Metadata = {
  title: "Omni Partner Network — businesses that grow together",
  description:
    "The Omni Partner Network is a cross-promotion alliance of Utah and Southwest businesses sharing one agentic growth engine: every member is featured across the network's sites, newsletters, and media brands.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Omni Partner Network",
    description:
      "A cross-promotion alliance of businesses sharing one agentic growth engine — featured across the network's sites, newsletters, and media brands.",
    url: pageUrl,
    siteName: "Omni AI",
    images: [{ url: ogImage }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni Partner Network",
    description:
      "Businesses that grow together: cross-promoted across sites, newsletters, and media brands on one agentic engine.",
    images: [ogImage],
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  "home-services": "Home Services",
  wellness: "Health & Wellness",
  professional: "Professional Services",
  media: "Media",
  commerce: "Commerce",
  community: "Community",
  personal: "Spotlights",
};

export default function NetworkPage() {
  const groups: Array<[string, typeof PARTNER_NETWORK]> = [];
  for (const m of PARTNER_NETWORK) {
    const existing = groups.find(([cat]) => cat === m.category);
    if (existing) {
      existing[1].push(m);
    } else {
      groups.push([m.category, [m]]);
    }
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <header className="border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            OMNI AI
          </Link>
          <Link
            href="/book"
            className="text-xs font-semibold uppercase tracking-widest text-indigo-300 hover:text-indigo-200"
          >
            Join the network
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mb-3">
          Omni Partner Network
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
          Businesses that grow together.
        </h1>
        <p className="text-white/70 leading-relaxed mb-3">
          Every member of this network is featured across the others&apos;
          websites, newsletters, and media brands — one shared audience,
          compounding for everyone in it. One engine runs it: tracking every
          impression and click, rotating every feature, around the clock.
        </p>
        <p className="text-white/50 text-sm leading-relaxed mb-10">
          If a member told you about this network, this page is the proof.
          If you want your business in it, the door is at the bottom.
        </p>

        {groups.map(([category, members]) => (
          <section key={category} className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40 mb-4">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="space-y-3">
              {members.map((m) => (
                <a
                  key={m.slug}
                  href={`${m.href}?utm_source=omni-network&utm_medium=network-page&utm_campaign=${m.utmCampaign}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-baseline justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 hover:border-white/25 hover:bg-white/[0.06] transition"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{m.name}</span>
                    <span className="block text-sm text-white/60">
                      {m.tagline}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-indigo-300">
                    {m.cta} →
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-14 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-6">
          <h2 className="text-lg font-bold mb-2">Put your business here.</h2>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            Network members get featured across every site and newsletter you
            see above, an editorial feature in our media brands, and the same
            agentic growth engine working for them around the clock.
          </p>
          <Link
            href="/book"
            className="inline-block rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-bold hover:bg-indigo-400 transition"
          >
            Book a 15-minute call
          </Link>
        </section>
      </main>
    </div>
  );
}
