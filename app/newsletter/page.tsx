import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Metadata } from "next";
import { Mail, Users, Eye } from "lucide-react";
import { NewsletterHeader, PremiumSection } from "@/components/newsletter-premium-gate";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
// The newsletter archive was rendering with no footer at all — readers who
// scrolled past the post list had nowhere to go. Add the shared Footer so
// /about, /faq, /campaigns, /interlinked are one hop away from the content
// hub. Matches the pattern added to /about and /faq in the same cycle.
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Omni AI Newsletter — Daily AI Strategy & Intelligence",
  description:
    "Stories, strategies, and signals that matter — delivered daily at 8 AM. Free and premium AI intelligence from Omni AI.",
  keywords:
    "AI newsletter, business intelligence, AI automation, Omni AI, Interlinked, daily AI briefs, AI strategy",
  // Canonical URL so UTM / ref / share-parameter variants resolve to a
  // single indexable page. /newsletter is the archive hub — every daily
  // post links back up here, so a split canonical would fracture PageRank.
  alternates: { canonical: "https://omnileadsagi.com/newsletter" },
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

// Manual floors so the page never under-represents reach when a signup
// source hasn't been wired into Supabase yet. Update these as real counts
// grow past them.
const SUBSCRIBERS_FLOOR = 13;
const IMPRESSIONS_FLOOR = 2000;

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k+`;
  return `${n}`;
}

export default async function NewsletterIndexPage() {
  const supabase = createAdminClient();

  // Pull posts + live counts in parallel. The three stat queries are cheap
  // COUNTs; failures fall back to 0 and the floor kicks in.
  const [postsRes, profileSubRes, newsletterSubRes, sendsRes] = await Promise.all([
    supabase
      .from("newsletter_posts")
      .select("slug, subject, intro, keywords, tier, published_at, created_at")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("newsletter_subscribed", true),
    supabase.from("newsletter_subscriptions").select("id", { count: "exact", head: true }),
    supabase.from("newsletter_sends").select("recipients_count"),
  ]);

  const posts = postsRes.data || [];
  const premiumPosts = posts.filter(p => p.tier === "premium");
  const freePosts = posts.filter(p => p.tier !== "premium");

  const postsSent = posts.length;
  const liveSubs = (profileSubRes.count || 0) + (newsletterSubRes.count || 0);
  const subscribersCount = Math.max(liveSubs, SUBSCRIBERS_FLOOR);

  // Rough viewer estimate: every send × avg 2 opens (open-rate proxy) until
  // real tracking lands. Floor guarantees the number matches what we've
  // already done manually/externally.
  const sendsTotal = (sendsRes.data || []).reduce(
    (sum, r: { recipients_count?: number | null }) => sum + (r.recipients_count || 0),
    0
  );
  const viewersEstimate = sendsTotal * 2 + postsSent * 20;
  const viewersCount = Math.max(viewersEstimate, IMPRESSIONS_FLOOR);

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
      <NewsletterHeader />

      <main className="relative z-10 max-w-4xl mx-auto px-5 py-12 md:py-20">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Omni AI Newsletter
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            The businesses that move with AI don&apos;t just survive — they become
            untouchable. Stories, strategies, and the signals that matter.
            Daily intelligence briefs delivered every morning at 8:00 AM.
          </p>
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
              const tagsToShow = (post.keywords || []).slice(0, 11);
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
                <p className="text-lg mb-2">No issues yet.</p>
                <p className="text-sm">
                  The first newsletter will be published tomorrow at 8:00 AM ET.
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
