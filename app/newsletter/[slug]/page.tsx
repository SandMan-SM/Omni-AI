import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FireSparksBackdrop } from "@/components/fire-sparks-backdrop";
import { ShareButton } from "@/components/share-button";
import { JsonLd, newsArticleSchema, breadcrumbSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
// Per-issue archive pages had no site footer — a reader who finished a post
// could only share or click the CTA. Adding the shared Footer gives them a
// path back into the site (FAQ, About, Campaigns, Newsletter index).
import { Footer } from "@/components/footer";
import { FeaturedBusinessCard } from "@/components/newsletter/FeaturedBusinessCard";
import { NewsletterStarCredit } from "@/components/newsletter/NewsletterStarCredit";
import { getShoutoutForSlug } from "@/lib/newsletter-shoutouts";
import { SponsorBanner } from "@/components/sponsor/SponsorBanner";
import { getNewsletterFallbackPost, getNewsletterFallbackSummaries, newsletterFallbackPosts, isOmniAiNewsletterPost } from "@/lib/newsletter-fallback";
import { newsletterIssueBackgroundImage } from "@/components/newsletter-issue-card";

// Per-issue pages are public content and must be fast from shared links.
// Known issues are generated from the protected fallback snapshot at build
// time, then ISR keeps the shell warm. Supabase is only used for brand-new
// slugs that are not in the snapshot yet.
export const revalidate = 300;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return newsletterFallbackPosts.map((post) => ({ slug: post.slug }));
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

function renderText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { heading?: unknown; title?: unknown; body?: unknown; text?: unknown };
    return [record.heading, record.title, record.body, record.text]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .trim();
  }
  return "";
}

function normalizeQuoteText(value: unknown): string {
  return renderText(value)
    .trim()
    .replace(/^[\s"'“”‘’]+/, "")
    .replace(/["“”‘’]+(\s+[—-]\s+)/, "$1")
    .replace(/[\s"'“”‘’]+$/, "");
}

function splitNumberedInsightText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const markers = Array.from(normalized.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g));
  const startsWithNumber = /^\d{1,2}[.)]\s+/.test(normalized);

  // Some generated posts store insights as one string like:
  // "1. First insight. 2. Second insight." Rendering that verbatim collapses
  // the whole section into one ugly paragraph on mobile. If a paragraph is
  // clearly a numbered insight list, strip the transient numbers and render
  // each item as the same standard paragraph block used everywhere else.
  if (startsWithNumber && markers.length >= 2) {
    return markers
      .map((marker, index) => {
        const markerIndex = marker.index ?? 0;
        const start = markerIndex + (marker[0].startsWith(" ") ? 1 : 0);
        const endMarker = markers[index + 1];
        const end = endMarker ? (endMarker.index ?? normalized.length) : normalized.length;
        return normalized.slice(start, end).replace(/^\d{1,2}[.)]\s+/, "").trim();
      })
      .filter(Boolean);
  }

  return [normalized];
}

function normalizeInsights(insights: unknown): string[] {
  if (Array.isArray(insights)) {
    return insights
      .flatMap((insight) => {
        if (typeof insight === "string") return splitNumberedInsightText(insight);
        if (insight && typeof insight === "object") {
          const record = insight as { body?: unknown; text?: unknown; heading?: unknown; title?: unknown };
          return splitNumberedInsightText(renderText(record.body || record.text || record.heading || record.title));
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof insights === "string") {
    return insights
      .split(/\n\s*\n+/)
      .flatMap((part) => splitNumberedInsightText(part))
      .filter(Boolean);
  }

  if (insights && typeof insights === "object") {
    return splitNumberedInsightText(renderText(insights));
  }

  return [];
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Use admin client so shared links always work — no auth/RLS gating on individual posts.
// Filter to published rows only: when an admin unpublishes a post (sets
// published_at = NULL) it should drop out of search-engine indexes AND stop
// resolving via direct URL, otherwise the "remove from feed" cleanup leaks
// content the operator explicitly took down. Drafts and removed issues now
// 404 cleanly here.
async function getPost(slug: string) {
  const fallbackPost = getNewsletterFallbackPost(slug);
  if (fallbackPost) return fallbackPost;

  const supabase = createAdminClient();
  const result = await withTimeout(
    supabase
      .from("newsletter_posts")
      .select("*")
      .eq("slug", slug)
      .or("published_at.not.is.null,status.eq.published")
      .maybeSingle(),
    2500
  );

  if (!result) return fallbackPost;
  const { data, error } = result as { data: ReturnType<typeof getNewsletterFallbackPost>; error?: unknown };
  const post = data || (error ? fallbackPost : fallbackPost);
  return post && isOmniAiNewsletterPost(post) ? post : null;
}

// Pick 3 related posts for the "Related issues" section. Logic:
//   1. Pull the 50 most recent posts (excluding the current one).
//   2. Score each by keyword-intersection count with the current post.
//   3. Tie-break by recency.
//   4. If the current post has no keywords (rare), fall back to the
//      3 most recent posts.
// Related issues must not block the article. Use the fallback snapshot so
// post pages can be statically generated/served from ISR without waiting on
// a live Supabase query for a footer shelf.
async function getRelatedPosts(
  currentSlug: string,
  currentKeywords: string[] | null | undefined
) {
  const fallbackCandidates = getNewsletterFallbackSummaries().filter((p) => p.slug !== currentSlug);
  const fallbackRelated = fallbackCandidates.slice(0, 3);

  const kwSet = new Set(normalizeKeywords(currentKeywords).map((k) => k.toLowerCase()));
  if (kwSet.size === 0) return fallbackRelated;

  // Score each candidate by keyword-intersection size with the current post.
  // Higher score first; recency breaks ties via the upstream DESC order.
  const scored = fallbackCandidates.map((p) => {
    const theirs = normalizeKeywords(p.keywords).map((k) => k.toLowerCase());
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

  const keywords = normalizeKeywords(post.keywords).join(", ") || "AI, business, automation";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  const postUrl = `${siteUrl}/newsletter/${slug}`;
  const ogImage = `${siteUrl}/newsletter/${encodeURIComponent(slug)}/opengraph-image`;
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
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const relatedPosts = await getRelatedPosts(slug, normalizeKeywords(post.keywords));

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
  const tagsToShow = normalizeKeywords(post.keywords).slice(0, 11);

  // Share metadata for the Web Share API (native share sheet on mobile +
  // modern desktop). Clipboard-copy fallback lives in the ShareButton.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  const postUrl = `${siteUrl}/newsletter/${slug}`;
  const heroImage = newsletterIssueBackgroundImage(post.slug);
  const quoteText = normalizeQuoteText(post.quote);
  const powerMoveText = renderText(post.power_move);
  const offerText = renderText(post.offer);
  const insightBodies = normalizeInsights(post.insights);

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
      <div className="relative z-10 max-w-5xl mx-auto px-5 pt-6">
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
      <article className="relative z-10 max-w-5xl mx-auto px-5 pt-6 pb-12 md:pb-20">
        {/* Hero image — same 1200x630 generated asset used for social sharing. */}
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-amber-500/20 bg-black shadow-[0_0_40px_rgba(245,158,11,0.08)]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-70"
            style={{ backgroundImage: heroImage }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.68)_48%,rgba(0,0,0,0.30)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-700" />
          <div className="relative flex min-h-[240px] flex-col justify-end p-5 sm:min-h-[320px] sm:p-8 md:min-h-[380px] md:p-10">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`text-xs font-semibold uppercase tracking-widest ${isPremium ? "text-amber-400" : "text-amber-300"}`}>
              {isPremium ? "Interlinked Premium" : "Interlinked Free"}
            </span>
              <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-500">{date}</span>
          </div>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            {post.subject}
          </h1>
          {/* Founder byline — visible E-E-A-T signal for Google, and the
              anchor LLMs use when asked "who wrote this?". Links to /about
              so the attribution resolves to a real Person entity. */}
            <p className="mt-4 text-sm text-gray-300">
            By{" "}
            <Link
              href="/about"
                className="text-gray-100 underline underline-offset-2 decoration-white/20 transition-colors hover:text-white hover:decoration-white/60"
            >
              Alfred Belvedere
            </Link>{" "}
            — Founder, Omni AI
          </p>
          {tagsToShow.length > 0 && (
              <details className="mt-5 group/tags">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-200">
                <svg className="w-3.5 h-3.5 transition-transform group-open/tags:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                {tagsToShow.length} tags
              </summary>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                {tagsToShow.map((kw: string) => (
                  <span
                    key={kw}
                      className="whitespace-nowrap rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-gray-300 backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[11px]"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </details>
          )}
          </div>
        </div>

        {/* Quote — centered in the article column so every issue uses the
            same balanced pull-quote treatment. Neutral lighter card bg
            keeps it readable against the fire-spark backdrop; accent
            border stays subtle. */}
        {quoteText && (
          <figure
            className={`mx-auto mt-8 mb-12 max-w-2xl rounded-3xl border bg-white/[0.06] px-8 py-12 sm:px-12 sm:py-14 backdrop-blur-sm ${
              isPremium ? "border-amber-500/30" : "border-purple-500/30"
            }`}
          >
            <blockquote>
              <p className="text-center text-lg md:text-xl text-gray-100 italic leading-[1.75]">
                &ldquo;{quoteText}&rdquo;
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
            {insightBodies.map((body: string, i: number) => {
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
        {powerMoveText && (
        <div className="mb-10">
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isPremium ? "text-amber-400" : "text-purple-400"}`}>
            Power Move
          </p>
          <p className="text-lg text-gray-200 leading-relaxed">
            {powerMoveText}
          </p>
        </div>
        )}

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
          {offerText && (
            <p className="text-gray-400 text-sm italic mb-5">{offerText}</p>
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

        {/* Sponsor + partnership block — Fred (sponsor) primary, Live
            Better Podcast (partnership) secondary. Renders on EVERY post
            regardless of shoutout state, sitting after the conversion
            CTA so it never competes with it for the headline action.
            All clicks + shares + impressions ping inbound_omnileads_events
            so the dashboard at /dashboard shows attribution. */}
        <SponsorBanner slug="omnileads" seed={post.slug || post.id || ""} />

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

        <NewsletterStarCredit
          newsletterSlug={post.slug}
          newsletterTitle={post.subject}
        />

      </article>
      <Footer />
    </div>
  );
}
