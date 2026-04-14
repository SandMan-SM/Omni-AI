import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Metadata } from "next";
import { NewsletterHeader, PremiumSection } from "@/components/newsletter-premium-gate";

export const metadata: Metadata = {
  title: "Omni AI Newsletter — Daily AI Strategy & Intelligence",
  description:
    "Stories, strategies, and signals that matter — delivered daily at 8 AM. Free and premium AI intelligence from Omni AI.",
  keywords:
    "AI newsletter, business intelligence, AI automation, Omni AI, Interlinked, daily AI briefs, AI strategy",
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

export const dynamic = "force-dynamic";

export default async function NewsletterIndexPage() {
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from("newsletter_posts")
    .select("slug, subject, intro, keywords, tier, published_at, created_at")
    .order("published_at", { ascending: false })
    .limit(50);

  const premiumPosts = posts?.filter(p => p.tier === "premium") || [];
  const freePosts = posts?.filter(p => p.tier !== "premium") || [];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <NewsletterHeader />

      <main className="max-w-4xl mx-auto px-5 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Omni AI Newsletter
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            The businesses that move with AI don&apos;t just survive — they become
            untouchable. Stories, strategies, and the signals that matter.
            Daily intelligence briefs delivered every morning at 8:00 AM.
          </p>
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
              return (
                <Link key={post.slug} href={`/newsletter/${post.slug}`} className="block group p-4 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/20 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors truncate">{post.subject}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.intro}</p>
                      {post.keywords?.length > 0 && (
                        <details className="mt-2 group/tags">
                          <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none flex items-center gap-1">
                            <svg className="w-3 h-3 transition-transform group-open/tags:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            {Math.min(post.keywords.length, 11)} tags
                          </summary>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5">
                            {post.keywords.slice(0, 11).map((kw: string) => (
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
                <p className="text-lg mb-2">No issues yet.</p>
                <p className="text-sm">
                  The first newsletter will be published tomorrow at 8:00 AM ET.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
