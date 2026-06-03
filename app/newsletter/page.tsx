import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Metadata } from "next";
import { Archive, ArrowRight, Rss } from "lucide-react";
import { NewsletterHeader, PremiumSection } from "@/components/newsletter-premium-gate";
import { JsonLd, breadcrumbSchema, itemListSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
// The newsletter archive was rendering with no footer at all — readers who
// scrolled past the post list had nowhere to go. Add the shared Footer so
// /about, /faq, /campaigns, /interlinked are one hop away from the content
// hub. Matches the pattern added to /about and /faq in the same cycle.
import { Footer } from "@/components/footer";
import { getNewsletterFallbackSummaries, isOmniAiNewsletterPost } from "@/lib/newsletter-fallback";
import { NewsletterIssueCard, type NewsletterCardPost } from "@/components/newsletter-issue-card";

export const metadata: Metadata = {
  title: "Omni AI Newsletter — Daily AI Strategy & Intelligence",
  description:
    "Stories, strategies, and signals that matter — delivered daily at 8 AM. Free and premium AI intelligence from Omni AI.",
  keywords:
    "AI newsletter, business intelligence, AI automation, Omni AI, Interlinked, daily AI briefs, AI strategy",
  // Canonical URL so UTM / ref / share-parameter variants resolve to a
  // single indexable page. /newsletter is the archive hub — every daily
  // post links back up here, so a split canonical would fracture PageRank.
  //
  // `types` exposes the RSS feed via <link rel="alternate" type="application/rss+xml">.
  // Feed readers (Feedly, Inoreader, Reeder) auto-discover the feed from
  // this tag the moment a user pastes the /newsletter URL — no manual
  // feed-URL paste required, which is the typical failure mode for B2B
  // RSS subscribers.
  alternates: {
    canonical: "https://omnileadsagi.com/newsletter",
    types: {
      "application/rss+xml": "https://omnileadsagi.com/newsletter/rss.xml",
    },
  },
  openGraph: {
    title: "Omni AI Newsletter — Daily AI Strategy & Intelligence",
    description:
      "Stories, strategies, and signals that matter — delivered daily at 8 AM. Free and premium tiers available.",
    url: "https://omnileadsagi.com/newsletter",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI Newsletter — Daily AI Strategy & Intelligence",
    description:
      "Stories, strategies, and signals that matter — delivered daily at 8 AM. Free and premium tiers available.",
  },
};

// Fast front shelf: only the latest 5 premium + 5 free posts render here.
// The full library lives at /newsletter/archive so the main page does not
// block on full-list reads, subscriber counts, or send analytics.
export const revalidate = 300;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function archiveDateForIndex(index: number): string {
  const date = new Date(Date.UTC(2026, 4, 31, 14, 0, 0));
  date.setUTCDate(date.getUTCDate() - index);
  return date.toISOString();
}

type RawNewsletterSummary = {
  slug: string | null;
  subject: string | null;
  intro: string | null;
  keywords: unknown;
  tier: string | null;
  published_at: string | null;
  created_at: string | null;
};

function normalizePost(p: RawNewsletterSummary, index: number): NewsletterCardPost {
  return {
    slug: p.slug!,
    subject: p.subject!,
    intro: p.intro || "",
    keywords: Array.isArray(p.keywords) || typeof p.keywords === "string" ? p.keywords : null,
    tier: (p.tier || "free").toLowerCase(),
    published_at: p.published_at || archiveDateForIndex(index),
    created_at: p.created_at || p.published_at || archiveDateForIndex(index),
  };
}

function sortNewsletterPosts(posts: NewsletterCardPost[]): NewsletterCardPost[] {
  return posts.sort(
    (a, b) =>
      new Date(b.published_at || b.created_at || 0).getTime() -
      new Date(a.published_at || a.created_at || 0).getTime()
  );
}

function mergeNewsletterPosts(
  primary: NewsletterCardPost[],
  fallback: NewsletterCardPost[]
): NewsletterCardPost[] {
  const bySlug = new Map<string, NewsletterCardPost>();
  for (const post of [...primary, ...fallback]) {
    if (!bySlug.has(post.slug)) bySlug.set(post.slug, post);
  }
  return sortNewsletterPosts(Array.from(bySlug.values()));
}

function fallbackFrontShelfPosts() {
  const fallbackPosts = getNewsletterFallbackSummaries()
    .filter((p) => p.slug && p.subject && (p.published_at || p.created_at) && isOmniAiNewsletterPost(p))
    .map((p, index) => normalizePost(p as RawNewsletterSummary, index));

  return sortNewsletterPosts(fallbackPosts);
}

function normalizeFilteredPosts(rows: RawNewsletterSummary[], indexOffset = 0): NewsletterCardPost[] {
  return rows
    .filter((p) => p.slug && p.subject && (p.published_at || p.created_at) && isOmniAiNewsletterPost(p))
    .map((p, index) => normalizePost(p, index + indexOffset));
}

export default async function NewsletterIndexPage() {
  const supabase = createAdminClient();

  const [premiumRes, freeRes] = await Promise.all([
    withTimeout(
      supabase
        .from("newsletter_posts")
        .select("slug, subject, intro, keywords, tier, published_at, created_at")
        .eq("tier", "premium")
        .or("published_at.not.is.null,status.eq.published")
        .order("published_at", { ascending: false })
        .limit(5),
      2500
    ),
    withTimeout(
      supabase
        .from("newsletter_posts")
        .select("slug, subject, intro, keywords, tier, published_at, created_at")
        .neq("tier", "premium")
        .or("published_at.not.is.null,status.eq.published")
        .order("published_at", { ascending: false })
        .limit(5),
      2500
    ),
  ]);

  const fallbackPosts = fallbackFrontShelfPosts();
  const rawPremium = (premiumRes as { data?: RawNewsletterSummary[]; error?: unknown } | null)?.data || [];
  const rawFree = (freeRes as { data?: RawNewsletterSummary[]; error?: unknown } | null)?.data || [];
  const livePremium = normalizeFilteredPosts(rawPremium);
  const liveFree = normalizeFilteredPosts(rawFree, livePremium.length);
  const premiumPosts = mergeNewsletterPosts(
    livePremium,
    fallbackPosts.filter((p) => p.tier === "premium")
  ).slice(0, 5);
  const freePosts = mergeNewsletterPosts(
    liveFree,
    fallbackPosts.filter((p) => p.tier !== "premium")
  ).slice(0, 5);
  const postsUnavailable =
    (!premiumRes || Boolean((premiumRes as { error?: unknown }).error)) &&
    (!freeRes || Boolean((freeRes as { error?: unknown }).error));
  const frontShelfPosts = [...premiumPosts, ...freePosts];
  const latestPremiumHref = premiumPosts[0]?.slug
    ? `/newsletter/${premiumPosts[0].slug}`
    : "#latest";

  return (
    // No opaque bg here — root layout's <SpaceBackdrop /> drifts behind.
    <div className="min-h-screen text-white relative">
      {/* BreadcrumbList — Home → Newsletter. Small but earns the
          breadcrumb chip in Google SERPs and gives /newsletter a
          parent-child path so LLM retrievers don't treat the archive
          index as an orphan. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "https://omnileadsagi.com/" },
          { name: "Newsletter", url: "https://omnileadsagi.com/newsletter" },
        ])}
      />
      {/* Blog + Periodical dual-type — closes the entity loop that
          newsArticleSchema opens on each post. Every individual
          newsletter issue declares isPartOf a Periodical named
          "Interlinked by Omni AI"; this schema is that Periodical,
          rendered on the archive page itself so retrievers have a
          canonical URL to anchor the publication entity to.

          Dual-typing as both Blog and Periodical widens retrieval
          surfaces: Blog pulls in Google's Blog rich-result surface
          (most competitive newsletter sites type as Blog), while
          Periodical matches the isPartOf references on the child
          posts and plays nicer with LLM "what publication does X
          work for?" queries. Schema.org supports dual @type values
          when the concepts overlap semantically — which Blog and
          Periodical clearly do.

          ItemList (shipped below) and this Blog are complementary
          not duplicative: ItemList enumerates specific posts (a
          discovery manifest); Blog describes the publication as an
          entity (author, publisher, language, genre). Both surfaces
          get fed; Google's parser handles the dual declaration cleanly. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": ["Blog", "Periodical"],
          name: "Interlinked — Daily AI Intelligence by Omni AI",
          alternateName: ["Interlinked", "Omni AI Newsletter", "Interlinked by Omni AI"],
          description:
            "Daily AI intelligence newsletter published every morning at 8 AM ET by Omni AI. Covers AI, automation, business strategy signals, and the operators-playbook stories that matter. Free daily tier plus an Interlinked Premium paid tier.",
          url: "https://omnileadsagi.com/newsletter",
          inLanguage: "en-US",
          genre: ["AI", "Business Intelligence", "Marketing Automation", "Business Strategy"],
          keywords: [
            "AI newsletter",
            "daily AI intelligence",
            "Interlinked",
            "Omni AI",
            "AI automation",
            "business AI",
          ],
          author: {
            "@type": "Person",
            name: "Alfred Belvedere",
            url: "https://omnileadsagi.com/about",
            jobTitle: "Founder, Omni AI",
          },
          // publisher.sameAs echoes the sitewide organizationSchema
          // so the Periodical's publisher resolves to the same
          // Organization entity declared in app/layout.tsx. Matches the
          // parity pattern applied across the Article / NewsArticle
          // factories and the Arena layouts — keep in lock-step.
          publisher: {
            "@type": "Organization",
            name: "Omni AI",
            url: "https://omnileadsagi.com",
            logo: {
              "@type": "ImageObject",
              url: "https://omnileadsagi.com/favicon.png",
            },
            sameAs: [
              "https://www.linkedin.com/company/omni-ai",
              "https://x.com/SitaniMafi",
            ],
          },
          // The RSS feed is the machine-readable distribution endpoint
          // for the Periodical — explicitly declaring it lets feed
          // aggregators (and LLMs that ingest feeds) discover the
          // canonical source without scraping the archive. Matches the
          // <link rel="alternate" type="application/rss+xml"> tag that
          // already ships in the route metadata above.
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": "https://omnileadsagi.com/newsletter",
          },
          workExample: {
            "@type": "DataFeed",
            name: "Interlinked RSS Feed",
            url: "https://omnileadsagi.com/newsletter/rss.xml",
            encodingFormat: "application/rss+xml",
          },
          // SpeakableSpecification — /newsletter is the canonical entity
          // page for the Interlinked publication itself (as opposed to
          // any single issue, which each ship their own speakable via
          // newsArticleSchema). When a voice assistant is asked "what is
          // the Omni AI newsletter?" / "what does Interlinked cover?",
          // Google Assistant / Siri read-aloud / Alexa need a declared
          // set of selectors to read verbatim. The h1 ("Omni AI
          // Newsletter") plus the intro paragraph tagged with
          // data-speakable="intro" (the ~3-sentence "stories,
          // strategies, signals that matter" pitch) compose the
          // natural ~10-second voice reply — a briefing-length
          // publication summary that cites the author, the cadence,
          // and the genre without forcing the assistant to extract it
          // from the archive's ItemList.
          //
          // This closes the last voice-retrieval gap on the newsletter
          // surface: individual issues (newArticleSchema) already
          // declare speakable, and now the Periodical itself does too,
          // so every Interlinked-related voice query lands on a
          // speakable-declared page regardless of whether the caller
          // asked about a specific issue or the publication overall.
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["h1", "[data-speakable='intro']"],
          },
        }}
      />
      {/* ItemList — tells Google and LLM retrievers that the archive is
          a structured list of articles (not an undifferentiated blob of
          links), so queries like "latest Omni AI newsletter" or "recent
          Interlinked issues" get a typed answer with walkable per-issue
          URLs. Cap at 20 so the schema stays focused on the most-relevant
          recent items instead of diluting rank across 50+. */}
      {frontShelfPosts.length > 0 && (
        <JsonLd
          data={itemListSchema({
            name: "Interlinked — Daily AI Intelligence by Omni AI",
            description:
              "Daily newsletter issues published every morning at 8 AM ET covering AI, automation, and business strategy signals.",
            url: "https://omnileadsagi.com/newsletter",
            items: frontShelfPosts.map((p) => ({
              name: p.subject,
              url: `https://omnileadsagi.com/newsletter/${p.slug}`,
              description: (p.intro || "").slice(0, 160) || undefined,
            })),
          })}
        />
      )}
      <NewsletterHeader />

      <main className="relative z-10 max-w-6xl mx-auto px-5 py-8 md:py-12">
        {/* Visible breadcrumb — pairs with breadcrumbSchema above so the
            SERP breadcrumb chip renders reliably on the archive (which
            receives heavy LLM-citation-driven deep landings), and gives
            feed-discovery visitors a one-click path back to the home
            page without having to scroll to the footer. */}
        <section className="mb-8 border-y border-white/[0.07] py-6 md:mb-12 md:py-10">
          <Breadcrumb
            items={[
              { name: "Home", href: "/" },
              { name: "Newsletter", href: "/newsletter" },
            ]}
            className="mb-5 md:mb-8"
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300 md:mb-5 md:text-[11px]">
                <span>Interlinked</span>
                <span className="h-px w-8 bg-amber-400/40" />
                <span className="text-sky-300">By Omni AI</span>
              </div>
              <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-normal text-white sm:text-4xl md:text-6xl md:leading-[0.98]">
                Omni AI Newsletter
              </h1>
              {/* data-speakable="intro" activates the SpeakableSpecification
                  declared on the Blog + Periodical JSON-LD above. Voice
                  assistants (Google Assistant, Siri read-aloud, Alexa)
                  concatenate h1 + this paragraph as the natural reply to
                  "what is the Omni AI newsletter?" / "what does Interlinked
                  cover?" voice queries. */}
              <p
                className="mt-4 max-w-3xl text-base leading-relaxed text-gray-300 md:mt-5 md:text-xl"
                data-speakable="intro"
              >
                The businesses that move with AI don&apos;t just survive. They
                compound. Interlinked tracks the stories, strategies, and
                operator signals that matter before the market catches up.
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5 md:mt-7 md:gap-3">
                <Link
                  href={latestPremiumHref}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 text-sm font-semibold text-amber-200 transition-colors hover:border-amber-300/60 hover:bg-amber-400/15 md:h-11 md:px-4"
                >
                  Latest issue
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/newsletter/archive"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-200 transition-colors hover:border-amber-400/30 hover:text-amber-200 md:h-11 md:px-4"
                >
                  <Archive className="h-4 w-4" />
                  Full archive
                </Link>
                <a
                  href="/newsletter/rss.xml"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-gray-400 transition-colors hover:border-sky-400/30 hover:text-sky-200 md:h-11 md:px-4"
                  aria-label="Subscribe to the Omni AI newsletter via RSS"
                >
                  <Rss className="h-4 w-4" />
                  RSS
                </a>
              </div>
            </div>
          </div>
        </section>

        <div
          id="latest"
          className="mb-8 flex flex-wrap items-end justify-between gap-4 scroll-mt-24"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
              Latest 10
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
              Newest Interlinked Issues
            </h2>
          </div>
          <Link
            href="/newsletter/archive"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-300 transition-colors hover:border-amber-400/30 hover:text-amber-200"
          >
            View archive
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Interlinked — Premium (client-side auth gate) */}
        <PremiumSection posts={premiumPosts} />

        {/* Daily Intelligence — Free */}
        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Interlinked Free
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Daily Intelligence</h2>
            </div>
            <span className="text-xs text-gray-500">
              Public operator briefings
            </span>
          </div>
          <div className="space-y-4">
            {freePosts.map((post) => {
              return (
                <NewsletterIssueCard key={post.slug} post={post} />
              );
            })}

            {freePosts.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <p className="text-lg mb-2">
                  {postsUnavailable ? "Newsletter issues are reconnecting." : "No issues yet."}
                </p>
                <p className="text-sm">
                  {postsUnavailable
                    ? "The archive is live, but the newsletter database did not return posts on this request. Please refresh shortly."
                    : "The first newsletter will be published tomorrow at 8:00 AM ET."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/newsletter/archive"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-5 text-sm font-semibold text-amber-300 transition-colors hover:border-amber-400/50 hover:bg-amber-500/[0.10]"
          >
            View full archive
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
