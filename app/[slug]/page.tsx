import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import CTAButtons from "./CTAButtons";
import { JsonLd, articleSchema, breadcrumbSchema } from "@/components/json-ld";
// Daily landing pages (/[slug]) are the site's largest traffic surface —
// each one had only a "Powered by Omni AI" minifooter. The shared Footer
// gives every daily tweet-landed visitor a path to /newsletter, /faq,
// /about, /campaigns, /interlinked. Doesn't violate the single-glow rule
// in CLAUDE.md because Footer has no background decoration.
import { Footer } from "@/components/footer";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getLandingPage(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("slug, topic, title, description, date, tweet_url")
    .eq("slug", slug)
    .single();
  return data;
}

// Pull the 3 most recent daily landing pages (excluding the current
// slug) for the "Recent Trends" hand-off below the hero. Serves two
// purposes:
//   1. Keeps tweet-landed visitors on site after they skip the CTA —
//      a related card is the cheapest retention lever on this surface.
//   2. Creates internal-link density across the daily cluster, which
//      is otherwise orphaned (every /[slug] is a direct Twitter landing
//      with no internal parent page today).
async function getRecentTrends(excludeSlug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("slug, topic, title, date")
    .neq("slug", excludeSlug)
    .not("slug", "is", null)
    .order("date", { ascending: false })
    .limit(3);
  return data || [];
}

// Cross-cluster handoff. /[slug] daily pages target quick-read visitors
// from Twitter; the newsletter targets deeper-read subscribers. A single
// card linking to the most recent newsletter post gives any /[slug]
// visitor a natural next-read into longer-form content — same
// retention mechanic as Recent Trends but across the second cluster, so
// Google reads the two clusters as one topical hub.
async function getLatestNewsletterPost() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("newsletter_posts")
    .select("slug, subject, intro, published_at, tier")
    .not("slug", "is", null)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page) return { title: "Not Found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  const title = page.title || page.topic;
  const description =
    page.description ||
    `${page.topic} — See how Omni AI helps businesses automate marketing and win with AI.`;
  const ogImage = `${siteUrl}/api/og?slug=${slug}&title=${encodeURIComponent(title)}&topic=${encodeURIComponent(page.topic)}`;

  return {
    title: `${title} | Omni AI`,
    description,
    keywords: `AI marketing, AI automation, ${page.topic}, Omni AI, business AI, lead generation`,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/${slug}`,
      siteName: "Omni AI",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: "@SitaniMafi",
    },
    alternates: {
      canonical: `${siteUrl}/${slug}`,
    },
  };
}

export default async function TrendingLandingPage({ params }: Props) {
  const { slug } = await params;
  // Fetch the landing page + related content in parallel. Three Supabase
  // calls fan-out at once — round-trip savings matter here because
  // /[slug] is the single highest-traffic route on the site and every
  // extra 50ms hurts tweet-landing conversion.
  const [page, recentTrends, latestNewsletter] = await Promise.all([
    getLandingPage(slug),
    getRecentTrends(slug),
    getLatestNewsletterPost(),
  ]);
  if (!page) notFound();

  const title = page.title || page.topic;
  const description =
    page.description ||
    `${page.topic} — See how Omni AI helps businesses automate marketing and win with AI.`;

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden">
      {/* Article JSON-LD — stronger retrieval signal than bare WebPage. The
          factory pairs author=Person(Sitani Mafi) + publisher=Organization
          + datePublished + OG image, which is what Google rich results and
          LLM citation engines both look for. */}
      <JsonLd
        data={articleSchema({
          slug,
          title: page.title,
          topic: page.topic,
          description,
          date: page.date,
        })}
      />
      {/* BreadcrumbList — lightweight polish that earns the breadcrumb chip
          in Google SERPs and gives LLM retrievers a clean parent-child path.
          Two-level crumb: Home → [landing page]. No intermediate section
          since daily landing pages live directly at the root URL. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "https://omnileadsagi.com/" },
          { name: title, url: `https://omnileadsagi.com/${slug}` },
        ])}
      />

      {/* Animated gradient background — single purple glow top-left only, no pink blob */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute rounded-full opacity-20 blur-3xl"
          style={{
            width: 700,
            height: 700,
            background: "radial-gradient(circle, #6366f1, transparent 70%)",
            top: -200,
            left: -200,
            animation: "drift1 14s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* Top shimmer bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{
          background: "linear-gradient(90deg, #6366f1, #ec4899, #06b6d4, #6366f1)",
          backgroundSize: "200% 100%",
          animation: "shimmer 3s linear infinite",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
          >
            Omni AI
          </Link>
          <Link
            href="/interlinked"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Book a Call →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[90vh] text-center px-5 py-20">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest text-purple-300 border border-purple-500/30"
          style={{ background: "rgba(99,102,241,0.1)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-purple-400"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          />
          Trending Now · Omni AI
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.02] tracking-tight mb-6 max-w-5xl">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #c4b5fd 0%, #f0abfc 40%, #67e8f9 100%)",
            }}
          >
            {title}
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-10">
          {description}
        </p>

        {/* CTA Buttons */}
        <CTAButtons slug={slug} />

        {/* Stats */}
        <div className="flex flex-nowrap justify-center items-center mt-36 w-full max-w-2xl mx-auto">
          {[
            { num: "10x", label: "Faster Content" },
            { num: "80%", label: "Cost Reduction" },
            { num: "24/7", label: "AI on Autopilot" },
          ].map(({ num, label }, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="text-center w-full py-2">
                <div
                  className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent mb-2"
                  style={{ backgroundImage: "linear-gradient(135deg, #818cf8, #22d3ee)" }}
                >
                  {num}
                </div>
                <div className="text-xs sm:text-sm text-white font-semibold uppercase tracking-widest">
                  {label}
                </div>
              </div>
              {i < 2 && (
                <div className="w-px h-14 bg-white/15 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Author byline + publish date. Visible E-E-A-T signal that
            matches the articleSchema author/datePublished fields. Newsletter
            posts carry the same byline under their H1; daily landing pages
            tuck it down here so the hero CTA flow stays uninterrupted.
            The <time> element with a machine-readable dateTime pairs with
            the JSON-LD datePublished for redundant freshness signals. */}
        {page.date && (
          <p className="mt-16 text-xs text-gray-400">
            Published{" "}
            <time dateTime={page.date} className="text-gray-300">
              {new Date(page.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            {" · By "}
            <Link
              href="/about"
              className="text-gray-300 hover:text-white underline underline-offset-2 decoration-white/20 hover:decoration-white/60 transition-colors"
            >
              Sitani Mafi
            </Link>
          </p>
        )}

        {/* Topic pill */}
        <p className="mt-3 text-xs text-white uppercase tracking-widest">
          Today&apos;s trend: {page.topic}
        </p>
      </main>

      {/* Recent Trends — renders only if siblings exist. Gives the
          tweet-landed visitor somewhere to go if the primary CTA
          doesn't land, and feeds Google a dense internal-link graph
          across the daily cluster (previously orphaned). Cards mirror
          the purple hero palette rather than the amber /vs cluster
          palette, so the brand feels consistent across the hand-off. */}
      {recentTrends.length > 0 && (
        <section className="relative z-10 max-w-6xl mx-auto px-5 pb-24">
          <div className="border-t border-white/5 pt-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-300 mb-6 text-center">
              More trending now
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentTrends.map((trend) => (
                <Link
                  key={trend.slug}
                  href={`/${trend.slug}`}
                  className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-purple-500/40 hover:bg-white/[0.06] transition-colors"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-300/70 mb-3">
                    Trending
                  </p>
                  <h3 className="text-lg font-bold text-white mb-3 leading-snug line-clamp-3 group-hover:text-purple-100 transition-colors">
                    {trend.title || trend.topic}
                  </h3>
                  {trend.date && (
                    <p className="text-xs text-gray-500">
                      {new Date(trend.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cross-cluster handoff to the Interlinked newsletter. A quick-read
          visitor from Twitter who wants the longer analysis has nowhere to
          go otherwise — the newsletter archive is two footer clicks away
          and most users never scroll that far. Single card (not a grid)
          so it reads as an editorial "next" rather than a second grid of
          content to scan. */}
      {latestNewsletter && latestNewsletter.slug && (
        <section className="relative z-10 max-w-3xl mx-auto px-5 pb-24">
          <Link
            href={`/newsletter/${latestNewsletter.slug}`}
            className="group block rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/[0.06] to-pink-500/[0.04] p-7 sm:p-8 hover:border-purple-500/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-300">
                From the Interlinked Newsletter
              </span>
              {latestNewsletter.tier === "premium" && (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
                  Premium
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-snug group-hover:text-purple-100 transition-colors">
              {latestNewsletter.subject}
            </h2>
            {latestNewsletter.intro && (
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-3 mb-4">
                {latestNewsletter.intro}
              </p>
            )}
            <p className="text-xs font-semibold text-purple-300 group-hover:text-purple-200 transition-colors">
              Read the full analysis →
            </p>
          </Link>
        </section>
      )}

      {/* Footer — shared site footer. Carries the full internal-linking set
          (Interlinked, Campaigns, Newsletter, About, FAQ, Infographic) so
          daily landing pages don't terminate the session if the CTA misses. */}
      <div className="relative z-10">
        <Footer />
      </div>

      <style>{`
        @keyframes drift1 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(80px, 60px) scale(1.2); }
        }
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}
