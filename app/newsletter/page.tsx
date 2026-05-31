import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Metadata } from "next";
import { Mail, Users, Eye, Rss } from "lucide-react";
import { NewsletterHeader, PremiumSection } from "@/components/newsletter-premium-gate";
import { JsonLd, breadcrumbSchema, itemListSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
// The newsletter archive was rendering with no footer at all — readers who
// scrolled past the post list had nowhere to go. Add the shared Footer so
// /about, /faq, /campaigns, /interlinked are one hop away from the content
// hub. Matches the pattern added to /about and /faq in the same cycle.
import { Footer } from "@/components/footer";
import { getNewsletterFallbackSummaries, isOmniAiNewsletterPost } from "@/lib/newsletter-fallback";

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

// ISR every 5 minutes. The listing needs to reflect new daily posts (dropped
// at 8am ET) and growing subscriber counts, but doesn't need to be real-time.
// Previously this was `force-dynamic` + `revalidate = 0` + `noStore()` — every
// visit hit Supabase for 4 parallel queries. At 5-min ISR the page is cached
// at the edge and one regeneration amortizes across every visitor in that
// window. The per-slug page `app/newsletter/[slug]/page.tsx` stays
// force-dynamic — it had a historical stale-tags bug that a separate fix
// should resolve before it gets ISR'd too.
export const revalidate = 300;
export const dynamic = "force-dynamic";

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k+`;
  return `${n}`;
}

function normalizeKeywords(keywords: unknown): string[] {
  if (Array.isArray(keywords)) return keywords.filter((kw): kw is string => typeof kw === "string");
  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((kw) => kw.trim())
      .filter(Boolean);
  }
  return [];
}

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

export default async function NewsletterIndexPage() {
  const supabase = createAdminClient();

  // Pull posts + live data in parallel. Subscriber count is computed from
  // the actual list of email addresses (deduped across the two sources)
  // rather than naive counts that double-count every overlap. Sends totals
  // come straight from `newsletter_sends.recipients_total`. NO manual
  // floors — the page shows the real number.
  const [postsRes, profileSubRes, newsletterSubRes, sendsRes] = await Promise.all([
    withTimeout(
      supabase
        .from("newsletter_posts")
        .select("slug, subject, intro, keywords, tier, published_at, created_at")
        .or("published_at.not.is.null,status.eq.published")
        .order("published_at", { ascending: false })
        .limit(50),
      8000
    ),
    withTimeout(
      supabase
        .from("profiles")
        .select("email")
        .eq("newsletter_subscribed", true)
        .not("email", "is", null)
        .limit(1000),
      3500
    ),
    withTimeout(
      supabase
        .from("newsletter_subscriptions")
        .select("email")
        .eq("subscribed", true)
        .not("email", "is", null)
        .limit(1000),
      3500
    ),
    withTimeout(supabase.from("newsletter_sends").select("recipients_total").limit(1000), 3500),
  ]);

  const supabasePosts = (postsRes as { data?: Array<{ slug: string | null; subject: string | null; intro: string | null; keywords: unknown; tier: string | null; published_at: string | null; created_at: string | null }> } | null)?.data || [];
  const rawPosts = supabasePosts.length > 0 ? supabasePosts : getNewsletterFallbackSummaries();
  const posts = rawPosts
    .filter((p) => p.slug && p.subject && (p.published_at || p.created_at) && isOmniAiNewsletterPost(p))
    .map((p, index) => ({
      slug: p.slug!,
      subject: p.subject!,
      intro: p.intro || "",
      keywords: Array.isArray(p.keywords) || typeof p.keywords === "string" ? p.keywords : null,
      tier: p.tier || "free",
      published_at: p.published_at || archiveDateForIndex(index),
      created_at: p.created_at || p.published_at!,
    }));
  const postsUnavailable = !postsRes || Boolean((postsRes as { error?: unknown }).error);
  const premiumPosts = posts.filter(p => p.tier === "premium");
  const freePosts = posts.filter(p => p.tier !== "premium");

  const postsSent = posts.length;

  // Dedup subscribers by lowercased email. A user who's both a profile
  // (logged-in) AND in newsletter_subscriptions (signed up via the form)
  // counts once.
  const subEmails = new Set<string>();
  for (const row of ((profileSubRes as { data?: Array<{ email: string | null }> } | null)?.data || [])) {
    if (row.email) subEmails.add(row.email.trim().toLowerCase());
  }
  for (const row of ((newsletterSubRes as { data?: Array<{ email: string | null }> } | null)?.data || [])) {
    if (row.email) subEmails.add(row.email.trim().toLowerCase());
  }
  const subscribersCount = subEmails.size;

  // Real recipient totals from logged sends (no inflation factors).
  const viewersCount = ((sendsRes as { data?: Array<{ recipients_total?: number | null }> } | null)?.data || []).reduce(
    (sum, r: { recipients_total?: number | null }) => sum + (r.recipients_total || 0),
    0
  );

  const stats = [
    { icon: Mail, value: String(postsSent), label: "Issues Sent" },
    { icon: Users, value: String(subscribersCount), label: "Subscribers" },
    { icon: Eye, value: fmtCompact(viewersCount), label: "Viewers" },
  ];

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
      {freePosts.length > 0 && (
        <JsonLd
          data={itemListSchema({
            name: "Interlinked — Daily AI Intelligence by Omni AI",
            description:
              "Daily newsletter issues published every morning at 8 AM ET covering AI, automation, and business strategy signals.",
            url: "https://omnileadsagi.com/newsletter",
            items: freePosts.slice(0, 20).map((p) => ({
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

        {/* Stats row — same visual pattern as the home page hero metrics:
            purple icon, white→purple→cyan gradient number, small label.
            No card frame; the space backdrop shows through behind it. */}
        <div className="mb-12 grid grid-cols-3 gap-4 sm:gap-14 md:gap-20 w-full max-w-xl mx-auto px-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center text-center gap-2"
              data-testid={`metric-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <s.icon className="w-5 h-5 text-purple-400" />
              <span
                className="text-2xl md:text-3xl font-bold tabular-nums"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #67e8f9 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {s.value}
              </span>
              <span className="text-[11px] sm:text-xs text-gray-500 tracking-wide">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Interlinked — Premium (client-side auth gate) */}
        <PremiumSection posts={premiumPosts} />

        {/* Daily Intelligence — Free */}
        <div>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-purple-400">Daily Intelligence</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-semibold">
              FREE
            </span>
          </div>
          <div className="space-y-4">
            {freePosts.map((post) => {
              const date = new Date(post.published_at || post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const tagsToShow = normalizeKeywords(post.keywords).slice(0, 11);
              return (
                <Link key={post.slug} href={`/newsletter/${post.slug}`} className="block group p-4 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/20 hover:bg-white/[0.04] transition-all backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors truncate">{post.subject}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.intro}</p>
                      {tagsToShow.length > 0 && (
                        <details className="mt-2 group/tags">
                          <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-1">
                            <svg className="w-3 h-3 transition-transform group-open/tags:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            {tagsToShow.length} tags
                          </summary>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5">
                            {tagsToShow.map((kw: string) => (
                              <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500 whitespace-nowrap">{kw}</span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 flex-shrink-0">{date}</p>
                  </div>
                </Link>
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
      </main>
      <Footer />
    </div>
  );
}
