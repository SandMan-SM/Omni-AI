import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { RedSparks } from "@/components/red-sparks";

// Always SSR fresh — keyword counts and copy should never serve stale cached
// markup. Older builds cached this page and kept showing "7 tags" after we
// padded rows to 11 in the DB.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

// Use admin client so shared links always work — no auth/RLS gating on individual posts
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

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Ambient red sparks canvas — drifts behind all content (zIndex:0) */}
      <RedSparks />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-sm bg-[#050505]/60">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gradient">
            Omni AI
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
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
            {post.subject}
          </h1>
          {post.keywords?.length > 0 && (
            <details className="mb-6 group/tags">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 transition-transform group-open/tags:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                {Math.min(post.keywords.length, 11)} tags
              </summary>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                {post.keywords.slice(0, 11).map((kw: string) => (
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

        {/* Quote — accent-soft card with a decorative quote mark in the
            top-left. Subtle gradient and larger radius to feel premium. */}
        {post.quote && (
          <div
            className={`relative mt-8 mb-12 rounded-2xl border border-white/[0.08] border-l-2 p-7 sm:p-10 overflow-hidden ${
              isPremium ? "border-l-amber-500" : "border-l-purple-500"
            }`}
            style={{
              background: isPremium
                ? "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02) 50%, rgba(255,255,255,0.02))"
                : "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02) 50%, rgba(255,255,255,0.02))",
            }}
          >
            <span
              aria-hidden
              className={`absolute top-3 left-5 select-none leading-none font-serif ${
                isPremium ? "text-amber-500/20" : "text-purple-500/20"
              }`}
              style={{ fontSize: "5rem" }}
            >
              &ldquo;
            </span>
            <blockquote className="relative">
              <p className="text-lg md:text-xl text-gray-200 italic leading-relaxed">
                &ldquo;{post.quote}&rdquo;
              </p>
            </blockquote>
          </div>
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

        {/* Premium exclusive sections */}
        {/* Power Move */}
        <div className="mb-10">
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isPremium ? "text-amber-400" : "text-purple-400"}`}>
            Power Move
          </p>
          <p className="text-lg text-gray-200 leading-relaxed">
            {post.power_move}
          </p>
        </div>

        {/* CTA — recap + simple offer + scheduler link. The recap uses the
            post's own intro so each issue's CTA is specific to what the
            reader just read, not generic filler. */}
        <div
          className={`mb-10 rounded-2xl border p-7 sm:p-9 text-center ${
            isPremium ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-purple-500/30 bg-purple-500/[0.04]"
          }`}
        >
          <p className={`text-[11px] font-mono uppercase tracking-[0.2em] mb-3 ${isPremium ? "text-amber-400" : "text-purple-400"}`}>
            Want this applied to your business?
          </p>
          <h3 className="text-xl md:text-2xl font-semibold text-white mb-3 leading-snug">
            {post.subject}
          </h3>
          <p className="text-gray-300 leading-relaxed max-w-xl mx-auto mb-3">
            That&rsquo;s the signal — here&rsquo;s the move. Book a free
            30-minute strategy session and we&rsquo;ll walk through exactly
            how to apply today&rsquo;s insight to your revenue, your team,
            and your next 90 days. No pitch. Just straight advice from
            operators who run AI systems for a living.
          </p>
          {post.offer && (
            <p className="text-gray-400 text-sm italic mb-5">{post.offer}</p>
          )}
          <Link
            href="/book-now"
            className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 ${
              isPremium
                ? "bg-gradient-to-r from-amber-500 to-amber-400 text-black"
                : "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            }`}
          >
            Schedule a Meeting
            <span aria-hidden>&rarr;</span>
          </Link>
          <p className="text-xs text-gray-500 mt-4">
            30 minutes · free · no obligation
          </p>
        </div>

        {/* Closing */}
        <p className="text-center text-gray-400 italic text-lg my-10">
          Powered by Omni AI
        </p>

      </article>
    </div>
  );
}
