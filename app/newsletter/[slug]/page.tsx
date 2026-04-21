/**
 * Newsletter read-on-web — landing target for the "Read on the web" link
 * in Interlinked Free and Premium emails.
 * Contract: docs/web-design-system.md. One accent per page (free=purple,
 * premium=amber). Prose is the hero; no dashboards here.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { WEB } from "@/components/ui/web-primitives";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
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
  const accent = isPremium ? WEB.amber : WEB.purple;
  const accentSoft = isPremium ? "#2a1f0a" : "#1f1230";
  const brandLabel = isPremium ? "Interlinked Premium" : "Interlinked · Daily Intelligence";

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: WEB.canvas, color: WEB.textBody }}>
      {/* Single top-left accent wash — never two */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] opacity-[0.12] blur-3xl"
        style={{ background: `radial-gradient(700px 360px at 18% 0%, ${accent}, transparent 70%)` }}
      />

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b"
        style={{ backgroundColor: "rgba(5,5,10,0.8)", borderColor: WEB.borderDefault }}
      >
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight"
            style={{ color: WEB.textPrimary }}
          >
            Omni AI
          </Link>
          <Link
            href="/newsletter"
            className="text-[12px] font-mono uppercase tracking-[0.16em] hover:opacity-80"
            style={{ color: WEB.textMuted }}
          >
            All issues
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="relative max-w-3xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-12">
        {/* Eyebrow + date */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] border"
            style={{ backgroundColor: accentSoft, color: accent, borderColor: `${accent}33` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
            {brandLabel}
          </span>
          <span className="text-xs" style={{ color: WEB.textSubtle }}>
            {date}
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.08] mb-6"
          style={{ color: WEB.textPrimary }}
        >
          {post.subject}
        </h1>

        {/* Quote */}
        {post.quote && (
          <blockquote
            className="relative my-8 md:my-10 rounded-2xl p-6 md:p-7 border-l-[3px]"
            style={{ backgroundColor: accentSoft, borderLeftColor: accent }}
          >
            <p
              className="text-lg md:text-xl italic leading-relaxed"
              style={{ color: WEB.textBody }}
            >
              {post.quote}
            </p>
          </blockquote>
        )}

        {/* Intro */}
        {post.intro && (
          <p
            className="text-lg md:text-[19px] leading-[1.75] mb-10 md:mb-14"
            style={{ color: WEB.textBody }}
          >
            {post.intro}
          </p>
        )}

        {/* Insights */}
        {post.insights?.length > 0 && (
          <section className="mb-10 md:mb-14">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-5"
              style={{ color: accent }}
            >
              {isPremium ? "Premium insights" : "Today's key insights"}
            </p>
            <div className="space-y-6 md:space-y-7">
              {post.insights.map((insight: string, i: number) => (
                <p
                  key={i}
                  className="text-base md:text-[17px] leading-[1.8]"
                  style={{ color: WEB.textBody }}
                >
                  {insight}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Premium-only exclusive insight */}
        {isPremium && post.exclusive_insight && (
          <section
            className="mb-10 md:mb-14 rounded-2xl p-6 md:p-8 border"
            style={{ backgroundColor: WEB.surface, borderColor: `${accent}33` }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4"
              style={{ color: accent }}
            >
              Exclusive for premium
            </p>
            <p
              className="text-base md:text-[17px] leading-[1.8]"
              style={{ color: WEB.textBody }}
            >
              {post.exclusive_insight}
            </p>
          </section>
        )}

        {/* Premium AI recommendation */}
        {isPremium && post.ai_recommendation && (
          <section
            className="mb-10 md:mb-14 rounded-2xl p-6 md:p-8 border-l-[3px]"
            style={{ backgroundColor: accentSoft, borderLeftColor: accent }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-3"
              style={{ color: accent }}
            >
              AI recommendation
            </p>
            <p
              className="text-base md:text-[17px] leading-[1.8]"
              style={{ color: WEB.textBody }}
            >
              {post.ai_recommendation}
            </p>
          </section>
        )}

        {/* Power Move */}
        {post.power_move && (
          <section className="mb-10 md:mb-14">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4"
              style={{ color: accent }}
            >
              Power move
            </p>
            <p
              className="text-lg md:text-[19px] leading-[1.75] font-medium"
              style={{ color: WEB.textPrimary }}
            >
              {post.power_move}
            </p>
          </section>
        )}

        {/* CTA */}
        <section
          className="mt-14 md:mt-20 rounded-2xl p-8 md:p-10 border text-center"
          style={{ backgroundColor: WEB.surface, borderColor: WEB.borderDefault }}
        >
          {post.offer && (
            <p
              className="text-base md:text-[17px] leading-[1.75] mb-6 max-w-2xl mx-auto"
              style={{ color: WEB.textBody }}
            >
              {post.offer}
            </p>
          )}
          <Link
            href="/book-now"
            className="inline-flex items-center justify-center h-12 px-7 rounded-xl text-sm md:text-[15px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: "#05050a" }}
          >
            Book a working session
          </Link>
          <p
            className="mt-4 text-[11px] font-mono uppercase tracking-[0.16em]"
            style={{ color: WEB.textSubtle }}
          >
            Powered by Omni AI
          </p>
        </section>

        {/* Keywords */}
        {post.keywords?.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.keywords.slice(0, 11).map((kw: string) => (
              <span
                key={kw}
                className="text-[11px] px-2.5 py-1 rounded-full border"
                style={{
                  color: WEB.textMuted,
                  borderColor: WEB.borderDefault,
                  backgroundColor: WEB.surface,
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Footer */}
      <footer
        className="border-t py-10"
        style={{ borderColor: WEB.borderDefault }}
      >
        <div className="max-w-3xl mx-auto px-5 md:px-8 text-center space-y-2">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.2em]"
            style={{ color: WEB.textSubtle }}
          >
            Omni AI · Interlinked
          </p>
          <p className="text-xs" style={{ color: WEB.textMuted }}>
            <Link href="/newsletter" className="underline underline-offset-4 hover:opacity-80">
              All issues
            </Link>
            <span style={{ color: WEB.textSubtle }}> · </span>
            <Link href="/book-now" className="underline underline-offset-4 hover:opacity-80">
              Book a session
            </Link>
            <span style={{ color: WEB.textSubtle }}> · </span>
            <Link href="/interlinked/premium" className="underline underline-offset-4 hover:opacity-80">
              Upgrade to Premium
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
