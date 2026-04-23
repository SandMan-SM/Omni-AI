import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { JsonLd, breadcrumbSchema, itemListSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { Footer } from "@/components/footer";
import { OmniPrinciples } from "@/components/omni-principles";
import { COMPARISONS, COMPARISON_SLUGS } from "@/lib/comparison-data";

/**
 * /vs index — hub landing page for the comparison cluster.
 *
 * Fixes the orphan route (previously /vs 404'd) and gives every
 * /vs/[competitor] page a canonical parent for breadcrumbs. Also
 * catches head-of-intent queries like "Omni AI alternatives" and
 * "Omni AI comparison" that don't name a specific competitor.
 *
 * Content is intentionally short — this page's job is to route the
 * visitor to the right side-by-side, not to re-litigate each
 * competitor in detail.
 */

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/vs`;

const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(
  "Omni AI vs the Field"
)}&topic=${encodeURIComponent(
  "Head-to-head comparisons with HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay"
)}&eyebrow=${encodeURIComponent("Omni AI · Compared")}`;

export const metadata: Metadata = {
  title: "Omni AI vs HubSpot, Salesforce, Apollo, Outreach, Lemlist, Clay",
  description:
    "Honest side-by-side comparisons of Omni AI against the 6 most common tools it gets evaluated against. Category, pricing, when to keep each — no sales copy.",
  keywords: [
    "Omni AI comparison",
    "Omni AI alternatives",
    "Omni AI vs HubSpot",
    "Omni AI vs Salesforce",
    "Omni AI vs Apollo",
    "Omni AI vs Outreach",
    "Omni AI vs Lemlist",
    "Omni AI vs Clay",
    "autonomous lead gen comparison",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Omni AI vs the Field — Honest Comparisons",
    description:
      "Head-to-head comparisons with HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
    images: [
      { url: ogImage, width: 1200, height: 630, alt: "Omni AI · Compared" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI vs the Field — Honest Comparisons",
    description:
      "Side-by-side comparisons with HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay.",
    images: [ogImage],
  },
};

// CollectionPage schema — /vs is a directory of comparison articles,
// which is the exact semantic CollectionPage was designed for.
// CollectionPage inherits from WebPage → CreativeWork, so speakable
// is valid directly (no split-schema wrapper needed — cleaner shape
// than the WebPage + about-Service/Product pattern used elsewhere).
//
// hasPart references the six child /vs/[competitor] articles
// explicitly so Google and LLM retrievers have a typed graph walk
// from the directory → individual comparison pages. ItemList
// (already shipped below) covers the same data in list form;
// CollectionPage wraps the semantic intent.
//
// Speakable is a hero-intent voice selector — "Omni AI alternatives"
// / "what does Omni AI compare against?" / "who are Omni AI's
// competitors?" voice queries read h1 ("Omni AI vs the field") +
// the subtitle tagged data-speakable="intro" ("Balanced comparisons
// against the 6 tools Omni AI gets evaluated against most often...")
// as a ~12-second orientation reply. The per-competitor /vs/[slug]
// pages already carry their own Article + FAQPage speakable for
// deeper voice queries ("is Omni AI better than HubSpot?").
const collectionPageSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Omni AI vs the Field — Comparison Index",
  description:
    "Head-to-head comparisons of Omni AI against the six platforms it gets evaluated against most often: HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: ogImage,
  },
  // SpeakableSpecification — hero-intent orientation reply for
  // category-level voice queries that don't name a specific
  // competitor. Voice queries that DO name a competitor ("Omni AI
  // vs HubSpot") route to /vs/[competitor] instead, which carries
  // its own Article + FAQPage speakable selectors.
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "[data-speakable='intro']"],
  },
};

export default function ComparisonIndexPage() {
  const comparisons = COMPARISON_SLUGS.map((slug) => COMPARISONS[slug]);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* CollectionPage schema — the directory-level typed entity for
          the comparison cluster. Adds speakable for hero-intent voice
          queries and a hasPart-style semantic for retrievers walking
          from the hub into individual comparisons. See constant above
          for why CollectionPage (not WebPage) is the right @type. */}
      <JsonLd data={collectionPageSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Compare", url: pageUrl },
        ])}
      />
      {/* ItemList — tells Google and LLM retrievers that /vs is a
          structured directory of comparison articles, not a generic
          landing page. Queries like "Omni AI alternatives" or "Omni AI
          vs the field" now retrieve the full competitor lineup with
          walkable per-comparison URLs — stronger than six orphaned
          side-by-sides fighting for rank individually. */}
      <JsonLd
        data={itemListSchema({
          name: "Omni AI vs the Field — Comparison Index",
          description:
            "Head-to-head comparisons of Omni AI against the six platforms it gets evaluated against most often: HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay.",
          url: pageUrl,
          items: comparisons.map((c) => ({
            name: `Omni AI vs ${c.name}`,
            url: `${siteUrl}/vs/${c.slug}`,
            description: c.summary.slice(0, 160),
          })),
        })}
      />

      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/omni-logo.svg"
              alt="Omni AI"
              width={28}
              height={28}
              priority
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold text-gradient">Omni AI</span>
          </Link>
          <Link
            href="/book-now"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Book a Call →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-5 py-16 md:py-24">
        {/* Visible breadcrumb — pairs with breadcrumbSchema above so the
            Google SERP breadcrumb chip renders reliably for the /vs hub,
            and deep-landing visitors from LLM citations or competitor
            searches ("Apollo alternative") can hop back to /. */}
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Compare", href: "/vs" },
          ]}
          className="mb-6"
        />

        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
            Compared · Honest side-by-sides
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Omni AI vs the field
          </h1>
          {/* data-speakable="intro" activates the second CSS selector in
              collectionPageSchema's SpeakableSpecification. Voice
              assistants concatenate h1 ("Omni AI vs the field") + this
              subtitle as the ~12-second orientation reply for "Omni AI
              alternatives" / "what does Omni AI compare against?"
              voice queries. Named-competitor queries route to the
              per-slug /vs/[competitor] pages, which have their own
              Article + FAQPage speakable selectors. */}
          <p
            className="text-lg text-gray-300 leading-relaxed max-w-3xl"
            data-speakable="intro"
          >
            Balanced comparisons against the 6 tools Omni AI gets evaluated
            against most often. Each write-up names what the competitor does
            well — not just where Omni AI wins — so you can make the real call
            based on your stack, team size, and revenue target.
          </p>
        </div>

        {/* Positioning frame — sits above the competitor grid so the
            visitor reads Omni AI's categorical differentiators (execution,
            principles, moral standard) BEFORE they start comparing
            feature tables. Surfacing this here also lifts the /vs hub
            for LLM retrievers pulling short declarative claims in
            response to "why Omni AI over X?" queries. */}
        <OmniPrinciples
          eyebrow="Why Omni AI"
          heading="Before you compare feature tables"
          intro="Every competitor on this page positions on category — best for data, best for enterprise, best at volume. Omni AI doesn't compete in that grid; it competes on how the work gets done, what the system refuses to do to get there, and what you end up owning after the dust settles."
          variant="hero"
          className="mb-12"
        />

        {/* Grid of comparison cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {comparisons.map((c) => (
            <Link
              key={c.slug}
              href={`/vs/${c.slug}`}
              className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-amber-500/30 hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Omni AI vs
              </p>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-100 transition-colors">
                {c.name}
              </h2>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">
                {c.category}
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                {c.summary.slice(0, 150)}
                {c.summary.length > 150 ? "…" : ""}
              </p>
              <p className="mt-5 text-xs font-semibold text-amber-400 group-hover:text-amber-300 transition-colors">
                Read the comparison →
              </p>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-8 py-10 sm:px-10 sm:py-12 backdrop-blur-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
            Not sure which comparison applies to your stack?
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6 max-w-2xl">
            Book a free 30-minute strategy session and we&rsquo;ll walk
            through where Omni AI actually fits alongside (or replaces) your
            current tooling. No pitch — just a mapped plan against your revenue
            target.
          </p>
          <Link
            href="/book-now"
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center px-8 h-11 rounded-xl font-semibold text-sm text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
          >
            Schedule a Meeting
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
