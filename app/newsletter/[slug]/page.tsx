import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";
import { FireSparksBackdrop } from "@/components/fire-sparks-backdrop";
import { ShareButton } from "@/components/share-button";
import { JsonLd, newsArticleSchema, breadcrumbSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
// Per-issue archive pages had no site footer — a reader who finished a post
// could only share or click the CTA. Adding the shared Footer gives them a
// path back into the site (FAQ, About, Campaigns, Newsletter index).
import { Footer } from "@/components/footer";
import { FeaturedBusinessCard } from "@/components/newsletter/FeaturedBusinessCard";
import { getShoutoutForSlug } from "@/lib/newsletter-shoutouts";

// HARD RESET — every layer of Next's caching is turned off on this route so
// the "N tags" counter and the post body always read live Supabase. Without
// all three of these + noStore() inside the query, Vercel kept serving the
// old 7-tag markup even after we padded rows to 11 in the DB.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string }>;
}

// Use admin client so shared links always work — no auth/RLS gating on individual posts
async function getPost(slug: string) {
  noStore();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("newsletter_posts")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}

// Cross-cluster handoff. /newsletter/[slug] readers are deep-reader
// subscribers; linking to the most recent /[slug] daily trending topic
// gives them a quick-read adjacent next-read and closes the loop on
// cross-cluster internal-link density. Previously the newsletter and
// daily clusters had zero mutual links; combined with the reverse
// direction (daily → newsletter), this lets Google treat the two
// clusters as a coherent topic hub.
async function getLatestTrend() {
  noStore();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("slug, topic, title, date")
    .not("slug", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .single();
  return data;
}

// Pick 3 related posts for the "Related issues" section. Logic:
//   1. Pull the 50 most recent posts (excluding the current one).
//   2. Score each by keyword-intersection count with the current post.
//   3. Tie-break by recency.
//   4. If the current post has no keywords (rare), fall back to the
//      3 most recent posts.
// Runs on every request — the page is force-dynamic so there's no ISR
// cache to warm. A single Supabase query over 50 rows is <50ms so the
// extra hit is fine on a page that already makes one query for the post.
async function getRelatedPosts(
  currentSlug: string,
  currentKeywords: string[] | null | undefined
) {
  noStore();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("newsletter_posts")
    .select("slug, subject, intro, published_at, tier, keywords")
    .neq("slug", currentSlug)
    .not("slug", "is", null)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(50);
  if (!data || data.length === 0) return [] as NonNullable<typeof data>;

  const kwSet = new Set((currentKeywords || []).map((k) => k.toLowerCase()));
  if (kwSet.size === 0) return data.slice(0, 3);

  // Score each candidate by keyword-intersection size with the current post.
  // Higher score first; recency breaks ties via the upstream DESC order.
  const scored = data.map((p) => {
    const theirs = (p.keywords || []).map((k: string) => k.toLowerCase());
    const overlap = theirs.reduce((n: number, k: string) => (kwSet.has(k) ? n + 1 : n), 0);
    return { post: p, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap);
  // If the top-3 have zero overlap we still fall through to most-recent;
  // the newsletter cluster has enough topical overlap that this branch
  // is rare but still worth guarding.
  return scored.slice(0, 3).map((s) => s.post);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Newsletter Not Found" };

  const keywords = post.keywords?.join(", ") || "AI, business, automation";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  const postUrl = `${siteUrl}/newsletter/${slug}`;
  // Dynamic 1200x630 OG image for the social auto-render card (Twitter /
  // LinkedIn / Slack). Before this, newsletter posts fell back to the
  // site-wide opengraph-image.tsx — every issue shared the same generic
  // "Omni AI / Lead Generation on Autopilot" art regardless of subject.
  // Now each shared link previews with the post's own headline and intro
  // using the same /api/og edge route the daily landing pages use, with
  // an Interlinked eyebrow so readers can tell newsletter cards from
  // trending-topic cards at a glance.
  const ogTopic = (post.intro || keywords).slice(0, 140);
  const ogImage =
    `${siteUrl}/api/og?slug=${slug}` +
    `&title=${encodeURIComponent(post.subject)}` +
    `&topic=${encodeURIComponent(ogTopic)}` +
    `&eyebrow=${encodeURIComponent("Omni AI · Interlinked")}`;
  return {
    title: `${post.subject} | Interlinked by Omni AI`,
    description: post.intro?.slice(0, 160),
    keywords,
    // Canonical URL — consolidates any UTM/referrer variations back to
    // the clean issue URL so duplicate-content signals don't split. Per
    // per-issue page is the most-indexed surface on the site after the
    // daily landing pages, so the canonical matters most here.
    // `types.application/rss+xml` exposes the feed via rel=alternate so
    // a reader who lands on a specific issue (from a tweet, email, or
    // LLM citation) can subscribe to the archive without going hunting.
    alternates: {
      canonical: postUrl,
      types: {
        "application/rss+xml": "https://omnileadsagi.com/newsletter/rss.xml",
      },
    },
    openGraph: {
      title: post.subject,
      description: post.intro?.slice(0, 160),
      type: "article",
      publishedTime: post.published_at,
      siteName: "Interlinked by Omni AI",
      url: postUrl,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: post.subject },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.subject,
      description: post.intro?.slice(0, 160),
      images: [ogImage],
      site: "@SitaniMafi",
    },
  };
}

export default async function NewsletterPostPage({ params }: Props) {
  noStore();
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // Related issues + latest daily trend — both run in parallel so the
  // card grid and cross-cluster handoff can be inlined into the
  // server-rendered HTML instead of a client-side hydration fetch.
  const [relatedPosts, latestTrend] = await Promise.all([
    getRelatedPosts(slug, post.keywords),
    getLatestTrend(),
  ]);

  const date = new Date(post.published_at || post.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isPremium = post.tier === "premium";
  // Featured-business shoutout — only fires for free posts whose slug
  // prefix matches a registered partner (prime_iv-, ltb-, leifson-, …).
  // Premium posts always return null. When a shoutout exists, the
  // standard "Schedule a Meeting" CTA is replaced with an iMessage-
  // style preview card pointing at the partner's site so readers
  // convert against the post's actual subject.
  const shoutout = getShoutoutForSlug(slug, post.tier, post.published_at);
  // Ensure the counter reflects what actually renders in the list below.
  const tagsToShow = (post.keywords || []).slice(0, 11);

  // Share metadata for the Web Share API (native share sheet on mobile +
  // modern desktop). Clipboard-copy fallback lives in the ShareButton.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  const postUrl = `${siteUrl}/newsletter/${slug}`;

  return (
    // No opaque bg — FireSparksBackdrop (and its dark radial wash) paints
    // through. This is the same backdrop used on /arena.
    <div className="min-h-screen text-white relative">
      {/* NewsArticle JSON-LD — tells Google Top Stories + LLM retrieval that
          this is a dated authored article, not a bare WebPage. The factory
          reuses the same author/publisher pair used on /about + /[slug]. */}
      <JsonLd data={newsArticleSchema(post)} />
      {/* BreadcrumbList — Home → Newsletter → [post subject]. Gives every
          per-issue page an earned breadcrumb chip in Google SERPs and
          carries the same parent-child hierarchy into LLM retrieval
          contexts, which helps models disambiguate which Omni AI issue a
          citation came from. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Newsletter", url: `${siteUrl}/newsletter` },
          { name: post.subject, url: postUrl },
        ])}
      />
      <FireSparksBackdrop />

      {/* Header — logo + wordmark, sits above the sparks. */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/40">
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
            href="/newsletter"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            All Issues
          </Link>
        </div>
      </header>

      {/* Visible breadcrumb — paired with breadcrumbSchema above. Google
          requires both the schema AND visible breadcrumbs for the SERP
          breadcrumb chip to render. Three-level path makes issue pages
          obviously navigable (Home → Newsletter → post). Positioned in
          the seam between the header and the article meta so it doesn't
          crowd the hero date/tier line. */}
      <div className="relative z-10 max-w-3xl mx-auto px-5 pt-6">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Newsletter", href: "/newsletter" },
            { name: post.subject, href: `/newsletter/${post.slug}` },
          ]}
          className="text-xs"
        />
      </div>

      {/* Article */}
      <article className="relative z-10 max-w-3xl mx-auto px-5 pt-6 pb-12 md:pb-20">
        {/* Meta */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <span className={`text-xs font-semibold uppercase tracking-widest ${isPremium ? "text-amber-400" : "text-purple-400"}`}>
              {isPremium ? "Interlinked Premium" : "Daily Intelligence"}
            </span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-500">{date}</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            {post.subject}
          </h1>
          {/* Founder byline — visible E-E-A-T signal for Google, and the
              anchor LLMs use when asked "who wrote this?". Links to /about
              so the attribution resolves to a real Person entity. */}
          <p className="text-sm text-gray-400 mb-6">
            By{" "}
            <Link
              href="/about"
              className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white/60 transition-colors"
            >
              Alfred Belvedere
            </Link>{" "}
            — Founder, Omni AI
          </p>
          {tagsToShow.length > 0 && (
            <details className="mb-6 group/tags">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 transition-transform group-open/tags:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                {tagsToShow.length} tags
              </summary>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                {tagsToShow.map((kw: string) => (
                  <span
                    key={kw}
                    className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-gray-400 whitespace-nowrap"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Quote — left-aligned blockquote indented past the paragraph
            edge. Neutral lighter card bg so the quote reads clearly against
            the fire-spark backdrop; accent border stays subtle. Generous
            top/bottom padding so the quote has room to breathe. */}
        {post.quote && (
          <figure
            className={`mt-8 mb-12 ml-4 sm:ml-10 rounded-3xl border bg-white/[0.06] px-8 py-12 sm:px-12 sm:py-14 backdrop-blur-sm ${
              isPremium ? "border-amber-500/30" : "border-purple-500/30"
            }`}
          >
            <blockquote>
              {/* Render the quote field VERBATIM. The DB stores the
                  closing curly quote BEFORE the attribution (— Name, Title)
                  so the punctuation reads naturally. We don't auto-wrap
                  here because that puts the closing mark after the
                  attribution, which is grammatically wrong. */}
              <p className="text-lg md:text-xl text-gray-100 italic leading-[1.75] text-left">
                {post.quote}
              </p>
            </blockquote>
          </figure>
        )}

        {/* Intro — data-speakable="intro" wires up the
            SpeakableSpecification on newsArticleSchema so Google
            Assistant news briefings, Siri read-aloud, and Alexa
            flash briefings read this lede verbatim together with
            the H1. Most newsrooms don't ship speakable — cheap
            competitive edge for voice-surface retrieval. */}
        <div className="mb-12">
          <p
            data-speakable="intro"
            className="text-lg text-gray-200 leading-relaxed"
          >
            {post.intro}
          </p>
        </div>

        {/* Insights
            ----------
            Two authoring shapes ship in production for `insights` and both
            need to render:

              1. Plain string — the original shape used by every post from
                 launch through 2026-04-22. Rendered as a single paragraph.
              2. { heading, body } object — the richer structured shape
                 first shipped on the 2026-04-23 vertical-SaaS premium
                 issue (and newer Premium issues going forward).

            Design call (per owner, 2026-04-23): only the section heading
            ("Premium Insights" / "Today's Key Insights") is styled. The
            per-insight `heading` field is deliberately NOT rendered — the
            founder prefers a clean, uninterrupted flow from section title
            → paragraphs → Power Move callout. For object-shaped insights
            we render only the `body` text; for plain-string insights the
            string itself is the body. Both shapes collapse to the same
            visual output: an evenly-spaced stack of paragraphs. The
            `heading` field stays in the DB for schema/metadata use (e.g.
            future RSS titles) but stays invisible on the page. */}
        <div className="mb-10">
          <h2 className={`text-xl font-semibold mb-6 ${isPremium ? "text-amber-400" : "text-gradient"}`}>
            {isPremium ? "Premium Insights" : "Today\u2019s Key Insights"}
          </h2>
          <div className="space-y-4">
            {post.insights?.map(
              (
                insight: string | { heading?: string | null; body?: string | null },
                i: number,
              ) => {
                // Collapse both shapes to a single body string. Object
                // insights contribute only their `body`; strings pass
                // through. Falsy/empty entries are skipped so an
                // accidentally-empty row never renders a blank <p>.
                const body =
                  insight && typeof insight === "object"
                    ? insight.body?.trim() || ""
                    : (insight as string) || "";
                if (!body) return null;
                return (
                  <div key={i} className="py-4">
                    <p className="text-gray-300 leading-relaxed">{body}</p>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Power Move */}
        <div className="mb-10">
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isPremium ? "text-amber-400" : "text-purple-400"}`}>
            Power Move
          </p>
          <p className="text-lg text-gray-200 leading-relaxed">
            {post.power_move}
          </p>
        </div>

        {/* Shoutout posts (free + slug matches a registered partner) swap
            the generic Schedule-a-Meeting CTA for a website-preview card
            pointing at the featured business. Keeps the post focused on
            the actual subject and pushes conversion to the partner. */}
        {shoutout && <FeaturedBusinessCard shoutout={shoutout} />}

        {/* CTA — recap + scheduler link + share. Gold styling on every
            post (not just premium) so the button reads as the headline
            action. Share icon sits to the right of the primary button.
            Left-aligned with generous, symmetric padding (40px top/bottom,
            32–40px left/right) so the copy breathes and the buttons have
            room on every side. */}
        {!shoutout && (
        <div className="mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-8 py-10 sm:px-10 sm:py-12 backdrop-blur-sm">
          <h3 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
            {post.subject}
          </h3>
          <p className="text-gray-300 leading-relaxed mb-3 max-w-2xl">
            That&rsquo;s the signal — here&rsquo;s the move. Book a free
            30-minute strategy session and we&rsquo;ll walk through exactly
            how to apply today&rsquo;s insight to your revenue, your team,
            and your next 90 days. No pitch. Just straight advice from
            operators who run AI systems for a living.
          </p>
          {post.offer && (
            <p className="text-gray-400 text-sm italic mb-5">{post.offer}</p>
          )}
          <div className="flex items-center gap-2 mt-6">
            <Link
              href="/book-now"
              style={{
                // Same chrome-gold gradient border trick as the share
                // button — dark interior on padding-box + chrome-gold
                // gradient on border-box + transparent 2px border.
                background:
                  "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
                border: "2px solid transparent",
              }}
              className="inline-flex items-center justify-center px-8 h-11 rounded-xl font-semibold text-sm text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
            >
              Schedule a Meeting
            </Link>
            <ShareButton
              title={`Interlinked: ${post.subject}`}
              text={post.intro || undefined}
              url={postUrl}
            />
          </div>
          <p className="text-xs text-gray-500 mt-5">
            30 minutes · free · no obligation
          </p>
        </div>
        )}

        {/* Closing */}
        <p className="text-center text-gray-400 italic text-lg my-10">
          Powered by Omni AI
        </p>

        {/* Related issues — 3 cards below the closing line. Boosts
            time-on-site on organic traffic and gives LLM retrieval a
            cluster of linked issues to traverse when the current post
            is cited. Scored by keyword overlap with the current post,
            with recency as the tie-breaker. */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-10 border-t border-white/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-5">
              More from Interlinked
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedPosts.map((r: {
                slug: string;
                subject: string;
                intro: string | null;
                published_at: string | null;
                tier: string | null;
              }) => {
                const rDate = r.published_at
                  ? new Date(r.published_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "";
                const rIsPremium = r.tier === "premium";
                return (
                  <Link
                    key={r.slug}
                    href={`/newsletter/${r.slug}`}
                    className="group block rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-widest ${
                          rIsPremium ? "text-amber-400" : "text-purple-400"
                        }`}
                      >
                        {rIsPremium ? "Premium" : "Daily"}
                      </span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-500">{rDate}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-amber-100 transition-colors">
                      {r.subject}
                    </h3>
                    {r.intro && (
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                        {r.intro.slice(0, 140)}
                        {r.intro.length > 140 ? "…" : ""}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
            <p className="mt-6 text-xs text-gray-500">
              See{" "}
              <Link
                href="/newsletter"
                className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white/60 transition-colors"
              >
                all Interlinked issues
              </Link>
              .
            </p>
          </section>
        )}

        {/* Cross-cluster handoff to today's trending daily landing page.
            Single editorial card (not a grid) so it reads as "one more
            thing" rather than a second shelf of related content. Pairs
            with the reverse-direction card on /[slug] pages shipped last
            cycle to close the cluster loop in both directions. */}
        {latestTrend && latestTrend.slug && (
          <section className="mt-10">
            <Link
              href={`/${latestTrend.slug}`}
              className="group block rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/[0.05] to-purple-500/[0.04] p-6 sm:p-7 hover:border-amber-500/30 transition-colors"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-3">
                Today&apos;s trending · Omni AI
              </p>
              <h3 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2 group-hover:text-amber-100 transition-colors">
                {latestTrend.title || latestTrend.topic}
              </h3>
              {latestTrend.topic && latestTrend.title && latestTrend.topic !== latestTrend.title && (
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  {latestTrend.topic}
                </p>
              )}
              <p className="text-xs font-semibold text-amber-400 group-hover:text-amber-300 transition-colors">
                See the trending brief →
              </p>
            </Link>
          </section>
        )}

      </article>
      <Footer />
    </div>
  );
}
