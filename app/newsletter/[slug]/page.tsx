import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";
import { FireSparksBackdrop } from "@/components/fire-sparks-backdrop";
import { ShareButton } from "@/components/share-button";
import { JsonLd, newsArticleSchema, breadcrumbSchema } from "@/components/json-ld";
// Per-issue archive pages had no site footer — a reader who finished a post
// could only share or click the CTA. Adding the shared Footer gives them a
// path back into the site (FAQ, About, Campaigns, Newsletter index).
import { Footer } from "@/components/footer";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Newsletter Not Found" };

  const keywords = post.keywords?.join(", ") || "AI, business, automation";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  return {
    title: `${post.subject} | Interlinked by Omni AI`,
    description: post.intro?.slice(0, 160),
    keywords,
    openGraph: {
      title: post.subject,
      description: post.intro?.slice(0, 160),
      type: "article",
      publishedTime: post.published_at,
      siteName: "Interlinked by Omni AI",
      url: `${siteUrl}/newsletter/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.subject,
      description: post.intro?.slice(0, 160),
    },
  };
}

export default async function NewsletterPostPage({ params }: Props) {
  noStore();
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const date = new Date(post.published_at || post.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isPremium = post.tier === "premium";
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

      {/* Article */}
      <article className="relative z-10 max-w-3xl mx-auto px-5 py-12 md:py-20">
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
              Sitani Mafi
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
              <p className="text-lg md:text-xl text-gray-100 italic leading-[1.75] text-left">
                &ldquo;{post.quote}&rdquo;
              </p>
            </blockquote>
          </figure>
        )}

        {/* Intro */}
        <div className="mb-12">
          <p className="text-lg text-gray-200 leading-relaxed">{post.intro}</p>
        </div>

        {/* Insights */}
        <div className="mb-10">
          <h2 className={`text-xl font-semibold mb-6 ${isPremium ? "text-amber-400" : "text-gradient"}`}>
            {isPremium ? "Premium Insights" : "Today\u2019s Key Insights"}
          </h2>
          <div className="space-y-4">
            {post.insights?.map((insight: string, i: number) => (
              <div key={i} className="py-4">
                <p className="text-gray-300 leading-relaxed">{insight}</p>
              </div>
            ))}
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

        {/* CTA — recap + scheduler link + share. Gold styling on every
            post (not just premium) so the button reads as the headline
            action. Share icon sits to the right of the primary button.
            Left-aligned with generous, symmetric padding (40px top/bottom,
            32–40px left/right) so the copy breathes and the buttons have
            room on every side. */}
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

        {/* Closing */}
        <p className="text-center text-gray-400 italic text-lg my-10">
          Powered by Omni AI
        </p>

      </article>
      <Footer />
    </div>
  );
}
