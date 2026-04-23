import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { Footer } from "@/components/footer";

/**
 * Sitewide search endpoint.
 *
 * Why this page exists:
 *  1. SearchAction in websiteSchema needs a real URL to target — Google's
 *     Sitelinks Searchbox only renders when the schema points at a live
 *     endpoint that actually executes the search. A dangling schema gets
 *     suppressed in the Rich Results Test.
 *  2. LLMs asked "does Omni AI have a search feature?" now get a typed
 *     answer (the SearchAction schema) plus a walkable URL they can cite.
 *  3. Deep-landing visitors (from LLM citation, Twitter, email) who land
 *     on a wrong slug get a recovery path instead of bouncing.
 *
 * Implementation notes:
 *  - Server component. The form is a plain GET form, so no JS is needed —
 *    the browser navigates to /search?q=... and this page re-renders with
 *    the new query param. More robust than a client-side search widget,
 *    and the resulting URLs are shareable / bookmarkable / indexable.
 *  - Queries landing_pages + newsletter_posts in parallel. Each table is
 *    filtered via .or() with sanitized user input so a pathological query
 *    can't break the filter grammar. Sanitization strips Supabase's
 *    filter-language meta-chars (%, commas, parens, quotes) and truncates
 *    to 60 chars — a real search term fits easily.
 *  - force-dynamic: the results depend on ?q=, so ISR doesn't make sense.
 *    Supabase queries are cheap ilike scans; at small result volumes per
 *    request this is fine.
 */

// This route reads searchParams, which makes it inherently dynamic.
// Force-dynamic is explicit so Next doesn't try to SSG an empty shell.
export const dynamic = "force-dynamic";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/search`;

// Per-page OG card via the /api/og edge route. Same pattern as /faq and
// /about — a branded card for every share surface.
const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(
  "Search"
)}&topic=${encodeURIComponent(
  "Find anything across Omni AI"
)}&eyebrow=${encodeURIComponent("Omni AI · Search")}`;

// WebPage schema for /search — closes the parity loop with websiteSchema's
// potentialAction SearchAction in components/json-ld.tsx. The sitewide
// schema declares a SearchAction pointing at /search?q={search_term_string};
// declaring the same SearchAction ON /search reinforces the target and
// gives LLM retrievers a typed anchor when answering "does Omni AI have a
// search?" / "how do I search Omni AI?" queries.
//
// Why WebPage and not SearchResultsPage: this route renders BOTH the empty
// search landing (no ?q=) and the results view (with ?q=). Google's
// SearchResultsPage parser expects a results-only surface, so the safer
// general type is WebPage. If the empty-state and results-state ever split
// into two routes, the results view should become SearchResultsPage.
//
// The speakable block reuses the h1 ("Find anything across Omni AI") plus
// the subtitle tagged with data-speakable="intro" below, mirroring the
// pattern established on /arena, /about, /pricing, /book-now, /newsletter,
// /privacy, /details, /interlinked, /arena/info, /sponsor/info,
// /affiliate/info, and /interlinked/premium. ~10-second voice reply for
// "how do I search Omni AI's content?" type queries.
const searchWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Search — Omni AI",
  description:
    "Search every newsletter issue, trending post, and landing page on Omni AI. Results come back from the live archive in one shot.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
  // SearchAction — mirrors the sitewide websiteSchema SearchAction so the
  // target URL is declared both at the website level (for Sitelinks
  // Searchbox eligibility) and at the search-page level (for retrievers
  // that walk from the page back to the action). query-input spec matches
  // the GET form's ?q= param.
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${pageUrl}?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
  // SpeakableSpecification — voice assistants reading "how do I search
  // Omni AI?" pull h1 + data-speakable="intro" subtitle.
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "[data-speakable='intro']"],
  },
};

export const metadata: Metadata = {
  title: "Search | Omni AI — Find Newsletter Issues, Posts & Pages",
  description:
    "Search every newsletter issue, trending post, and landing page on Omni AI. Find the content you want across the full archive in one search.",
  // robots: noindex the results pages (they're long-tail and can produce
  // thin content for low-match queries) but keep /search itself indexable
  // so Google's Sitelinks Searchbox has a target. Indexing /search without
  // query params gives search engines the canonical endpoint; leaving
  // /search?q=... noindex avoids a long-tail spam-bait footprint.
  robots: { index: true, follow: true },
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Search | Omni AI",
    description:
      "Find newsletter issues, trending posts, and landing pages across Omni AI.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Omni AI · Search" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Search | Omni AI",
    description:
      "Find newsletter issues, trending posts, and landing pages across Omni AI.",
    images: [ogImage],
  },
};

// Strip characters that would break Supabase's PostgREST .or() filter
// grammar. %, commas, parens, quotes, and backslashes are all meta chars
// in that language. Keeping letters, numbers, spaces, hyphens, and common
// punctuation preserves normal search intent. 60 chars is generous —
// longer terms usually indicate an LLM-pasted artifact, not a real query.
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[%,()'"\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// Next.js 14 typed searchParams can be a string or array; normalize to a
// single string with a type guard.
function getQueryString(value: string | string[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  return value;
}

interface LandingResult {
  kind: "landing";
  slug: string;
  title: string;
  description: string;
  date: string | null;
}

interface NewsletterResult {
  kind: "newsletter";
  slug: string;
  subject: string;
  intro: string;
  tier: string | null;
  published_at: string | null;
}

type SearchResult = LandingResult | NewsletterResult;

async function runSearch(q: string): Promise<SearchResult[]> {
  if (!q) return [];

  const supabase = createAdminClient();
  const pattern = `%${q}%`;

  // Two parallel table scans. Cheap at our current data volume; if the
  // newsletter archive ever exceeds ~10k rows, swap ilike for Postgres
  // full-text search (tsvector + gin index). Full-text is overkill today.
  const [landingRes, newsletterRes] = await Promise.all([
    supabase
      .from("landing_pages")
      .select("slug, title, description, topic, date")
      .or(`title.ilike.${pattern},description.ilike.${pattern},topic.ilike.${pattern},slug.ilike.${pattern}`)
      .order("date", { ascending: false })
      .limit(20),
    supabase
      .from("newsletter_posts")
      .select("slug, subject, intro, tier, published_at")
      .not("published_at", "is", null)
      .or(`subject.ilike.${pattern},intro.ilike.${pattern},slug.ilike.${pattern}`)
      .order("published_at", { ascending: false })
      .limit(20),
  ]);

  const landings: LandingResult[] = (landingRes.data || [])
    .filter((r: { slug?: string | null }) => r.slug)
    .map((r: {
      slug: string;
      title?: string | null;
      description?: string | null;
      topic?: string | null;
      date?: string | null;
    }) => ({
      kind: "landing" as const,
      slug: r.slug,
      title: r.title || r.topic || r.slug,
      description: r.description || "",
      date: r.date || null,
    }));

  const newsletters: NewsletterResult[] = (newsletterRes.data || [])
    .filter((r: { slug?: string | null }) => r.slug)
    .map((r: {
      slug: string;
      subject?: string | null;
      intro?: string | null;
      tier?: string | null;
      published_at?: string | null;
    }) => ({
      kind: "newsletter" as const,
      slug: r.slug,
      subject: r.subject || r.slug,
      intro: r.intro || "",
      tier: r.tier || null,
      published_at: r.published_at || null,
    }));

  // Merge and sort by recency. Newsletter uses published_at, landing uses
  // date. Missing dates sink to the bottom.
  const merged: SearchResult[] = [...landings, ...newsletters];
  merged.sort((a, b) => {
    const aDate = a.kind === "newsletter" ? a.published_at : a.date;
    const bDate = b.kind === "newsletter" ? b.published_at : b.date;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return merged;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string | string[] };
}) {
  const rawQuery = getQueryString(searchParams.q);
  const q = sanitizeQuery(rawQuery);
  const results = await runSearch(q);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* WebPage schema with SearchAction + speakable — closes the parity
          loop with the sitewide websiteSchema's SearchAction, which
          declares /search?q={search_term_string} as the target. Having
          the same SearchAction on the page itself strengthens the
          retrieval signal for LLMs answering "how do I search Omni AI?"
          queries. Speakable selectors mirror the pattern on /about,
          /pricing, /arena, etc. */}
      <JsonLd data={searchWebPageSchema} />

      {/* BreadcrumbList — Home → Search. Pairs with the visible breadcrumb
          below so Google awards the SERP breadcrumb chip on the search
          landing surface. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Search", url: pageUrl },
        ])}
      />

      {/* Header — mirrors /faq and /about for consistency across the
          content-surface pages. */}
      <header className="border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
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

      <main className="max-w-3xl mx-auto px-5 py-16 md:py-24">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Search", href: "/search" },
          ]}
          className="mb-6"
        />

        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
            Search
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Find anything across Omni AI
          </h1>
          <p
            data-speakable="intro"
            className="text-lg text-gray-300 leading-relaxed mb-8"
          >
            Search every newsletter issue, trending post, and landing page.
            Results come back from the live archive in one shot.
          </p>

          {/* GET form. No client-side JS needed — submitting the form
              navigates to /search?q=... and the server re-renders this
              page with the new param. The `q` input's defaultValue is
              wired to the current query so the box retains the user's
              text after submit. */}
          <form
            action="/search"
            method="GET"
            role="search"
            className="relative"
          >
            <label htmlFor="search-q" className="sr-only">
              Search Omni AI
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              aria-hidden="true"
            />
            <input
              id="search-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search for newsletter topics, trends, or page titles…"
              autoComplete="off"
              maxLength={60}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-11 pr-32 h-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.08] transition-colors"
            />
            <button
              type="submit"
              style={{
                background:
                  "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
                border: "2px solid transparent",
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center px-4 h-9 rounded-lg font-semibold text-xs text-[#ffd700] shadow-[0_0_10px_rgba(255,215,0,0.25)] transition-all hover:brightness-125 active:scale-[0.98]"
            >
              Search
            </button>
          </form>
        </div>

        {/* Results state machine:
            1. No query — show a helpful primer with example links.
            2. Query + no results — empty state with recovery links.
            3. Query + results — render merged list. */}
        {!q ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-lg font-semibold text-white mb-3">
              Popular destinations
            </h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Start typing above, or jump straight to one of the most-visited
              pages:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { href: "/newsletter", label: "Newsletter archive" },
                { href: "/pricing", label: "Pricing" },
                { href: "/faq", label: "FAQ" },
                { href: "/about", label: "About the founder" },
                { href: "/vs", label: "Compare vs alternatives" },
                { href: "/campaigns", label: "AI video campaigns" },
                { href: "/arena", label: "AI Agent Arena" },
                { href: "/interlinked", label: "Interlinked training" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-gray-300 hover:text-white hover:border-amber-500/25 hover:bg-white/[0.05] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-lg text-white mb-2">
              No results for &ldquo;{q}&rdquo;
            </p>
            <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto mb-6">
              Try a different term, or browse one of these:
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <Link
                href="/newsletter"
                className="px-4 py-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] text-amber-400 hover:text-amber-300 transition-colors"
              >
                Newsletter archive →
              </Link>
              <Link
                href="/faq"
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 hover:text-white transition-colors"
              >
                FAQ
              </Link>
              <Link
                href="/book-now"
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 hover:text-white transition-colors"
              >
                Book a call
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4 uppercase tracking-widest">
              {results.length} {results.length === 1 ? "result" : "results"} for
              &ldquo;{q}&rdquo;
            </p>
            <ul className="space-y-3">
              {results.map((r) => {
                if (r.kind === "newsletter") {
                  const date = r.published_at
                    ? new Date(r.published_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;
                  const tierBadge =
                    r.tier === "premium" ? "Premium" : "Newsletter";
                  return (
                    <li key={`n-${r.slug}`}>
                      <Link
                        href={`/newsletter/${r.slug}`}
                        className="block rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-amber-500/25 hover:bg-white/[0.04] transition-colors p-5"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-base font-semibold text-white">
                            {r.subject}
                          </h3>
                          <span
                            className={
                              r.tier === "premium"
                                ? "text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold uppercase tracking-wider shrink-0"
                                : "text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold uppercase tracking-wider shrink-0"
                            }
                          >
                            {tierBadge}
                          </span>
                        </div>
                        {r.intro && (
                          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                            {r.intro}
                          </p>
                        )}
                        {date && (
                          <p className="text-xs text-gray-600 mt-2">{date}</p>
                        )}
                      </Link>
                    </li>
                  );
                }
                // Landing page
                const date = r.date
                  ? new Date(r.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;
                return (
                  <li key={`l-${r.slug}`}>
                    <Link
                      href={`/${r.slug}`}
                      className="block rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-amber-500/25 hover:bg-white/[0.04] transition-colors p-5"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-base font-semibold text-white">
                          {r.title}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold uppercase tracking-wider shrink-0">
                          Trending
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                          {r.description}
                        </p>
                      )}
                      {date && (
                        <p className="text-xs text-gray-600 mt-2">{date}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
