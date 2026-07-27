import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FireSparksBackdrop } from "@/components/fire-sparks-backdrop";
import { JsonLd, newsArticleSchema, breadcrumbSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
// Per-issue archive pages had no site footer — a reader who finished a post
// could only share or click the CTA. Adding the shared Footer gives them a
// path back into the site (FAQ, About, Campaigns, Newsletter index).
import { Footer } from "@/components/footer";
import { FeaturedBusinessCard } from "@/components/newsletter/FeaturedBusinessCard";
import { NewsletterBookingWidget } from "@/components/newsletter/NewsletterBookingWidget";
import { NewsletterStarCredit } from "@/components/newsletter/NewsletterStarCredit";
import { getShoutoutForSlug } from "@/lib/newsletter-shoutouts";
import { SponsorBanner } from "@/components/sponsor/SponsorBanner";
import { getNewsletterFallbackPost, getNewsletterFallbackSummaries, newsletterFallbackPosts, isOmniAiNewsletterPost } from "@/lib/newsletter-fallback";
import {
  NewsletterIssueCard,
  newsletterIssueImageUrl,
  type NewsletterCardPost,
} from "@/components/newsletter-issue-card";

// Per-issue pages are public content and must be fast from shared links.
// Known issues are generated from the protected fallback snapshot at build
// time, then ISR keeps the shell warm. Supabase is only used for brand-new
// slugs that are not in the snapshot yet.
export const revalidate = 300;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
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

function archiveDateForIndex(index: number): string {
  const date = new Date(Date.UTC(2026, 4, 31, 14, 0, 0));
  date.setUTCDate(date.getUTCDate() - index);
  return date.toISOString();
}

function normalizeCardPost(post: RawNewsletterSummary, index: number): NewsletterCardPost {
  return {
    slug: post.slug!,
    subject: post.subject!,
    intro: post.intro || "",
    keywords: Array.isArray(post.keywords) || typeof post.keywords === "string" ? post.keywords : null,
    tier: (post.tier || "free").toLowerCase(),
    published_at: post.published_at || archiveDateForIndex(index),
    created_at: post.created_at || post.published_at || archiveDateForIndex(index),
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

function normalizeFilteredPosts(rows: RawNewsletterSummary[], indexOffset = 0): NewsletterCardPost[] {
  return rows
    .filter((p) => p.slug && p.subject && (p.published_at || p.created_at) && isOmniAiNewsletterPost(p))
    .map((p, index) => normalizeCardPost(p, index + indexOffset));
}

function fallbackFrontShelfPosts() {
  const fallbackPosts = getNewsletterFallbackSummaries()
    .filter((p) => p.slug && p.subject && (p.published_at || p.created_at) && isOmniAiNewsletterPost(p))
    .map((p, index) => normalizeCardPost(p, index));

  return sortNewsletterPosts(fallbackPosts);
}

// Bottom shelves mirror the /newsletter premium/free card carousels and
// exclude the issue the reader is currently on.
async function getMoreIssueShelves(currentSlug: string) {
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
  )
    .filter((p) => p.slug !== currentSlug)
    .slice(0, 5);
  const freePosts = mergeNewsletterPosts(
    liveFree,
    fallbackPosts.filter((p) => p.tier !== "premium")
  )
    .filter((p) => p.slug !== currentSlug)
    .slice(0, 5);

  return { premiumPosts, freePosts };
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

  const { premiumPosts, freePosts } = await getMoreIssueShelves(slug);

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
  const heroImage = newsletterIssueImageUrl(post.slug);
  const quoteText = normalizeQuoteText(post.quote);
  const powerMoveText = renderText(post.power_move);
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
        {/* Hero artwork stays behind the article header. The per-slug image
            is decorative here because the visible H1 names the issue; the
            dark overlays preserve the original hero readability. */}
        <div className="relative mb-10 min-h-[430px] overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-950 shadow-[0_0_40px_rgba(245,158,11,0.08)] sm:min-h-[460px]">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 960px"
            quality={88}
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,5,14,0.20)_0%,rgba(20,11,48,0.42)_62%,rgba(8,8,18,0.72)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-700" />
          <div className="relative flex min-h-[430px] flex-col justify-end p-5 sm:min-h-[460px] sm:p-8 md:p-10">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`text-xs font-semibold uppercase tracking-widest ${isPremium ? "text-amber-400" : "text-amber-300"}`}>
                {isPremium ? "Interlinked Premium" : "Interlinked Free"}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-300">{date}</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
              {post.subject}
            </h1>
            {/* Founder byline — visible E-E-A-T signal for Google, and the
                anchor LLMs use when asked "who wrote this?". Links to /about
                so the attribution resolves to a real Person entity. */}
            <p className="mt-4 text-sm text-gray-200 drop-shadow-md">
              By{" "}
              <Link
                href="/about"
                className="text-white underline underline-offset-2 decoration-white/30 transition-colors hover:decoration-white/70"
              >
                Alfred Belvedere
              </Link>{" "}
              — Founder, Omni AI
            </p>
            {tagsToShow.length > 0 && (
              <details className="mt-5 group/tags">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-gray-300 transition-colors hover:text-white">
                  <svg className="w-3.5 h-3.5 transition-transform group-open/tags:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  {tagsToShow.length} tags
                </summary>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                  {tagsToShow.map((kw: string) => (
                    <span
                      key={kw}
                      className="whitespace-nowrap rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] text-gray-100 backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[11px]"
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

        {/* CTA — inline 1:1 scheduler tied to the current article. */}
        {!shoutout && (
          <div className="mb-10 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.10] via-white/[0.035] to-sky-500/[0.08] px-5 py-6 text-center backdrop-blur-sm sm:px-7 sm:py-7">
            <div className="mb-5">
              <NewsletterStarCredit
                newsletterSlug={post.slug}
                newsletterTitle={post.subject}
                compact
              />
            </div>
            <div
              className="mb-6 flex items-center gap-3"
              aria-label="or"
            >
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300/35" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/70">
                Or
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300/35" />
            </div>
            <NewsletterBookingWidget articleTitle={post.subject} />
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

        {(premiumPosts.length > 0 || freePosts.length > 0) && (
          <section className="mt-16 space-y-10 border-t border-white/5 pt-10">
            {premiumPosts.length > 0 && (
              <div>
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                      Interlinked Premium
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-white">More Premium Intelligence</h2>
                  </div>
                  <Link
                    href="/newsletter/archive"
                    className="text-xs font-semibold text-amber-200 underline underline-offset-4 decoration-amber-300/30 transition-colors hover:text-amber-100 hover:decoration-amber-200"
                  >
                    Full archive
                  </Link>
                </div>
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {premiumPosts.map((relatedPost) => (
                    <div key={relatedPost.slug} className="w-[78vw] max-w-[340px] shrink-0 snap-start">
                      <NewsletterIssueCard post={relatedPost} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {freePosts.length > 0 && (
              <div>
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                      Interlinked Free
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-white">More Daily Intelligence</h2>
                  </div>
                  <Link
                    href="/newsletter/archive"
                    className="text-xs font-semibold text-amber-200 underline underline-offset-4 decoration-amber-300/30 transition-colors hover:text-amber-100 hover:decoration-amber-200"
                  >
                    Full archive
                  </Link>
                </div>
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {freePosts.map((relatedPost) => (
                    <div key={relatedPost.slug} className="w-[78vw] max-w-[340px] shrink-0 snap-start">
                      <NewsletterIssueCard post={relatedPost} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

      </article>
      <Footer />
    </div>
  );
}
