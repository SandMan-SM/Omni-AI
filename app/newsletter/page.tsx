import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Metadata } from "next";
import { Rss } from "lucide-react";
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
        .limit(50),
      2500
    ),
    withTimeout(
      supabase
        .from("newsletter_posts")
        .select("slug, subject, intro, keywords, tier, published_at, created_at")
        .neq("tier", "premium")
        .or("published_at.not.is.null,status.eq.published")
        .order("published_at", { ascending: false })
        .limit(50),
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

      <main className="relative z-10 max-w-4xl mx-auto px-5 py-12 md:py-20">
        {/* Visible breadcrumb — pairs with breadcrumbSchema above so the
            SERP breadcrumb chip renders reliably on the archive (which
            receives heavy LLM-citation-driven deep landings), and gives
            feed-discovery visitors a one-click path back to the home
            page without having to scroll to the footer. */}
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Newsletter", href: "/newsletter" },
          ]}
          className="mb-6"
        />

        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Omni AI Newsletter
          </h1>
          {/* data-speakable="intro" activates the SpeakableSpecification
              declared on the Blog + Periodical JSON-LD above. Voice
              assistants (Google Assistant, Siri read-aloud, Alexa)
              concatenate h1 + this paragraph as the natural reply to
              "what is the Omni AI newsletter?" / "what does Interlinked
              cover?" voice queries. */}
          <p
            className="text-gray-400 text-lg max-w-xl mx-auto"
            data-speakable="intro"
          >
            The businesses that move with AI don&apos;t just survive — they become
            untouchable. Stories, strategies, and the signals that matter.
            Daily intelligence briefs delivered every morning at 8:00 AM.
          </p>
          {/* Visible RSS affordance — pairs with the sitewide
              <link rel="alternate" type="application/rss+xml"> tag added in
              an earlier cycle. The alternate tag handles feed-reader auto-
              discovery, but auto-discovery only fires when the reader is
              already on the page; a visible link lets a power user hand the
              URL to a different reader, paste it into a bookmarklet, or
              share it with a colleague without hunting through <head>. The
              link is intentionally muted (gray-500, small, icon-led) so it
              reads as a utility affordance, not a primary CTA competing with
              the post list below. */}
          <a
            href="/newsletter/rss.xml"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-400 transition-colors"
            aria-label="Subscribe to the Omni AI newsletter via RSS"
          >
            <Rss className="w-3.5 h-3.5" />
            Subscribe via RSS
          </a>
        </div>

        <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
            Latest 10
          </span>
          <Link
            href="/newsletter/archive"
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
          >
            View full archive
          </Link>
        </div>

        {/* Interlinked — Premium (client-side auth gate) */}
        <PremiumSection posts={premiumPosts} />

        {/* Daily Intelligence — Free */}
        <div>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-amber-400">Daily Intelligence</h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Interlinked Free
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
