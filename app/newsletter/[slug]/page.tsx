import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const supabase = await createClient();
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

  const date = new Date(post.published_at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isPremium = post.tier === "premium";

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
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
      <article className="max-w-3xl mx-auto px-5 py-12 md:py-20">
        {/* Meta */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-xs font-semibold uppercase tracking-widest ${isPremium ? "text-yellow-400" : "text-purple-400"}`}>
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

        {/* Quote */}
        {post.quote && (
          <blockquote className={`border-l-2 ${isPremium ? "border-yellow-500" : "border-purple-500"} pl-4 mt-8 mb-12`}>
            <p className="text-lg text-gray-300 italic leading-relaxed">
              {post.quote}
            </p>
          </blockquote>
        )}

        {/* Intro */}
        <div className="mb-12">
          <p className="text-lg text-gray-200 leading-relaxed">{post.intro}</p>
        </div>

        {/* Insights */}
        <div className="mb-10">
          <h2 className={`text-xl font-semibold mb-6 ${isPremium ? "text-yellow-400" : "text-gradient"}`}>
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
          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isPremium ? "text-yellow-400" : "text-purple-400"}`}>
            Power Move
          </p>
          <p className="text-lg text-gray-200 leading-relaxed">
            {post.power_move}
          </p>
        </div>

        {/* CTA */}
        <div className="mb-10 text-center">
          {post.offer && (
            <p className="text-gray-200 leading-relaxed mb-4">{post.offer}</p>
          )}
          <Link
            href="/interlinked"
            className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Schedule a Meeting
          </Link>
        </div>

        {/* Closing */}
        <p className="text-center text-gray-400 italic text-lg my-10">
          Powered by Omni AI
        </p>

      </article>
    </div>
  );
}
