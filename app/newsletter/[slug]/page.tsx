/**
 * ============================================================================
 *  INTERLINKED — WEB ARTICLE PAGE  (LOCKED — do not restructure)
 * ============================================================================
 *  This page is the web counterpart of the Interlinked email. It mirrors the
 *  email template section-for-section, in the same order, with the same
 *  copy for non-dynamic blocks (CTA tagline, $50K callout, keywords label).
 *
 *  Sources of truth:
 *    - docs/newsletter-structure.md       (what sections exist, in what order)
 *    - docs/web-design-system.md          (token palette + typography scale)
 *    - lib/newsletter-sender.ts           (buildNewsletterEmailHtml — email twin)
 *    - lib/email-template.ts              (THEME tokens for email side)
 *
 *  Rules enforced here:
 *    1. One accent per page. Free = purple. Premium = amber. Never mixed.
 *    2. Max read width = max-w-3xl. Never wider (breaks read rhythm).
 *    3. Every email section has a web counterpart here — do not drop sections
 *       because a field "looks empty." Show nothing or show the section, but
 *       do not collapse the layout and leave orphan buttons.
 *    4. CTA tagline is hard-coded copy from the email, NOT post.offer. The
 *       offer field is deprecated in the new template (docs/newsletter-structure.md).
 *    5. Tokens come from `@/components/ui/web-tokens` (server-safe). Do NOT
 *       import from web-primitives here — that's a client module and SSR on a
 *       proxied token object hits TDZ ("Cannot access amber before init").
 *
 *  Section order (must match email):
 *    1.  Sticky top bar (Omni AI · All issues)
 *    2.  Eyebrow brand pill + subtitle date line
 *    3.  Title (H1)
 *    4.  Quote bubble (if quote present)
 *    5.  Intro paragraph
 *    6.  "Today's insights" — label + paragraphs (no bullets, ever)
 *    7.  Premium · exclusive insight (premium only, if present)
 *    8.  AI tool of the week callout (premium only, if present)
 *    9.  Power move callout
 *    10. CTA block — locked tagline + [Book Now] [Share]
 *    11. $50K certification callout
 *    12. Today's trends — keyword pill strip
 *    13. Footer
 *
 *  If you need to add a section, add it to BOTH this file AND
 *  lib/newsletter-sender.ts (email) AND docs/newsletter-structure.md (doc)
 *  in the same commit. Drift between the three is the bug this comment
 *  exists to prevent.
 * ============================================================================
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { WEB } from "@/components/ui/web-tokens";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
const TELEGRAM_INVITE = "https://t.me/+HxMnLSV1FYs0YmIx";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Newsletter Not Found" };
  const keywords = post.keywords?.join(", ") || "AI, business, automation";
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
      url: `${SITE_URL}/newsletter/${slug}`,
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
  const dateShort = new Date(post.published_at || post.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isPremium = post.tier === "premium";
  const accent = isPremium ? WEB.amber : WEB.purple;
  const accentSoft = isPremium ? "#2a1f0a" : "#1f1230";
  const brandTitle = isPremium ? "Interlinked Premium" : "Interlinked";
  const subtitleLine = isPremium
    ? `Daily Premium Intelligence Brief · ${dateShort}`
    : `Daily Intelligence Brief · ${dateShort}`;

  // Share mailto — same shape as the email "Share" button so recipients
  // sharing from the web get the same hand-off experience.
  const postUrl = `${SITE_URL}/newsletter/${slug}`;
  const shareSubject = encodeURIComponent(`Interlinked: ${post.subject}`);
  const shareBody = encodeURIComponent(
    `Today's Interlinked brief from Omni AI:\n\n${post.subject}\n\n${postUrl}\n\nBook a working session anytime: ${SITE_URL}/book-now`
  );
  const shareHref = `mailto:?subject=${shareSubject}&body=${shareBody}`;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: WEB.canvas, color: WEB.textBody }}>
      {/* Single top-left accent wash — never two. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] opacity-[0.12] blur-3xl"
        style={{ background: `radial-gradient(700px 360px at 18% 0%, ${accent}, transparent 70%)` }}
      />

      {/* 1. Top bar */}
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

      <article className="relative max-w-3xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-12">
        {/* 2. Eyebrow brand pill + subtitle date line (mirrors email header) */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] border"
            style={{ backgroundColor: accentSoft, color: accent, borderColor: `${accent}33` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
            {brandTitle}
          </span>
          <span
            className="text-[12px] font-mono uppercase tracking-[0.14em]"
            style={{ color: WEB.textSubtle }}
          >
            {subtitleLine}
          </span>
        </div>
        <p className="text-xs mb-6" style={{ color: WEB.textSubtle }}>
          {date}
        </p>

        {/* 3. Title */}
        <h1
          className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.08] mb-6"
          style={{ color: WEB.textPrimary }}
        >
          {post.subject}
        </h1>

        {/* 4. Quote */}
        {post.quote && (
          <blockquote
            className="relative my-8 md:my-10 rounded-2xl p-6 md:p-7 border-l-[3px]"
            style={{ backgroundColor: accentSoft, borderLeftColor: accent }}
          >
            <p
              className="text-lg md:text-xl italic leading-relaxed text-center"
              style={{ color: accent }}
            >
              {post.quote}
            </p>
          </blockquote>
        )}

        {/* 5. Intro */}
        {post.intro && (
          <p
            className="text-lg md:text-[19px] leading-[1.75] mb-10 md:mb-12"
            style={{ color: WEB.textBody }}
          >
            {post.intro}
          </p>
        )}

        {/* 6. Today's insights */}
        {post.insights?.length > 0 && (
          <section className="mb-10 md:mb-12">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-5"
              style={{ color: accent }}
            >
              Today&apos;s insights
            </p>
            <div
              className="rounded-2xl border p-6 md:p-8 space-y-5"
              style={{ backgroundColor: WEB.surface, borderColor: WEB.borderDefault }}
            >
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

        {/* 7. Premium · exclusive insight (premium only) */}
        {isPremium && post.exclusive_insight && (
          <section className="mb-10 md:mb-12">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-3"
              style={{ color: accent }}
            >
              Premium · exclusive insight
            </p>
            <div
              className="rounded-2xl border p-6 md:p-8"
              style={{ backgroundColor: WEB.surface, borderColor: WEB.borderDefault }}
            >
              <p
                className="text-base md:text-[17px] leading-[1.8]"
                style={{ color: WEB.textBody }}
              >
                {post.exclusive_insight}
              </p>
            </div>
          </section>
        )}

        {/* 8. AI tool of the week (premium only) */}
        {isPremium && post.ai_recommendation && (
          <section
            className="mb-10 md:mb-12 rounded-2xl p-6 md:p-7 border-l-[3px]"
            style={{ backgroundColor: accentSoft, borderLeftColor: accent }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-[0.16em] mb-2 font-semibold"
              style={{ color: accent }}
            >
              AI tool of the week
            </p>
            <p
              className="text-base md:text-[17px] leading-[1.75]"
              style={{ color: WEB.textBody }}
            >
              {post.ai_recommendation}
            </p>
          </section>
        )}

        {/* 9. Power move */}
        {post.power_move && (
          <section
            className="mb-10 md:mb-12 rounded-2xl p-6 md:p-7 border-l-[3px]"
            style={{ backgroundColor: accentSoft, borderLeftColor: accent }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-[0.16em] mb-2 font-semibold"
              style={{ color: accent }}
            >
              Power move
            </p>
            <p
              className="text-base md:text-[17px] leading-[1.75] font-medium"
              style={{ color: WEB.textPrimary }}
            >
              {post.power_move}
            </p>
          </section>
        )}

        {/* 10. CTA block — locked tagline (mirrors email) */}
        <section
          className="mb-10 md:mb-12 rounded-2xl p-8 md:p-10 border text-center"
          style={{ backgroundColor: WEB.surface, borderColor: WEB.borderDefault }}
        >
          <p
            className="text-base md:text-[17px] leading-[1.75] mb-6 max-w-xl mx-auto"
            style={{ color: WEB.textBody }}
          >
            Book a free 30-minute strategy session — or share this with someone who needs it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/book-now"
              className="inline-flex items-center justify-center h-12 px-7 rounded-xl text-sm md:text-[15px] font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent, color: "#05050a" }}
            >
              Book Now
            </Link>
            <a
              href={shareHref}
              className="inline-flex items-center justify-center h-12 px-7 rounded-xl text-sm md:text-[15px] font-semibold border transition-colors hover:bg-white/[0.04]"
              style={{ borderColor: WEB.borderStrong, color: WEB.textBody, backgroundColor: "transparent" }}
            >
              Share
            </a>
          </div>
        </section>

        {/* 11. $50K certification callout */}
        <section
          className="mb-10 md:mb-12 rounded-2xl p-5 md:p-6 border text-center"
          style={{ backgroundColor: accentSoft, borderColor: `${accent}33` }}
        >
          <p
            className="text-sm md:text-[15px] font-semibold mb-1"
            style={{ color: accent }}
          >
            Get a $50,000 certification — free
          </p>
          <p className="text-xs md:text-[13px]" style={{ color: WEB.textMuted }}>
            Sponsored by Omni AI ·{" "}
            <a
              href={TELEGRAM_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:opacity-80"
              style={{ color: WEB.cyan }}
            >
              Join the community
            </a>
          </p>
        </section>

        {/* 12. Today's trends — keyword strip */}
        {post.keywords?.length > 0 && (
          <section className="mb-4">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em] mb-3"
              style={{ color: WEB.textSubtle }}
            >
              Today&apos;s trends
            </p>
            <div className="flex flex-wrap gap-2">
              {post.keywords.slice(0, 12).map((kw: string) => (
                <span
                  key={kw}
                  className="text-[12px] px-3 py-1 rounded-full border"
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
          </section>
        )}
      </article>

      {/* 13. Footer */}
      <footer
        className="border-t py-10"
        style={{ borderColor: WEB.borderDefault }}
      >
        <div className="max-w-3xl mx-auto px-5 md:px-8 text-center space-y-2">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.2em]"
            style={{ color: WEB.textSubtle }}
          >
            Omni AI · Interlinked{isPremium ? " Premium" : ""}
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
            {isPremium ? (
              <Link href="/affiliate/info" className="underline underline-offset-4 hover:opacity-80">
                Affiliate program
              </Link>
            ) : (
              <Link href="/interlinked/premium" className="underline underline-offset-4 hover:opacity-80">
                Upgrade to Premium
              </Link>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
