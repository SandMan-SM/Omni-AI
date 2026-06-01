import { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/breadcrumb";
import { Footer } from "@/components/footer";
import { JsonLd, breadcrumbSchema, itemListSchema } from "@/components/json-ld";
import { NewsletterHeader } from "@/components/newsletter-premium-gate";
import { NewsletterIssueCard, type NewsletterCardPost } from "@/components/newsletter-issue-card";
import { getNewsletterFallbackSummaries, isOmniAiNewsletterPost } from "@/lib/newsletter-fallback";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Interlinked Newsletter Archive — Omni AI",
  description:
    "The full Interlinked newsletter archive from Omni AI: free and premium AI intelligence issues for operators building with automation.",
  alternates: {
    canonical: "https://omnileadsagi.com/newsletter/archive",
    types: {
      "application/rss+xml": "https://omnileadsagi.com/newsletter/rss.xml",
    },
  },
  openGraph: {
    title: "Interlinked Newsletter Archive — Omni AI",
    description:
      "Browse the full Interlinked archive of Omni AI intelligence briefings.",
    url: "https://omnileadsagi.com/newsletter/archive",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked Newsletter Archive — Omni AI",
    description:
      "Browse the full Interlinked archive of Omni AI intelligence briefings.",
  },
};

type RawNewsletterSummary = {
  slug: string | null;
  subject: string | null;
  intro: string | null;
  keywords: unknown;
  tier: string | null;
  published_at: string | null;
  created_at: string | null;
};

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function fallbackDateForIndex(index: number): string {
  const date = new Date(Date.UTC(2026, 4, 31, 14, 0, 0));
  date.setUTCDate(date.getUTCDate() - index);
  return date.toISOString();
}

function normalizePost(p: RawNewsletterSummary, index: number): NewsletterCardPost {
  return {
    slug: p.slug!,
    subject: p.subject!,
    intro: p.intro || "",
    keywords: Array.isArray(p.keywords) || typeof p.keywords === "string" ? p.keywords : null,
    tier: (p.tier || "free").toLowerCase(),
    published_at: p.published_at || fallbackDateForIndex(index),
    created_at: p.created_at || p.published_at || fallbackDateForIndex(index),
  };
}

function sortNewsletterPosts(posts: NewsletterCardPost[]): NewsletterCardPost[] {
  return posts.sort(
    (a, b) =>
      new Date(b.published_at || b.created_at || 0).getTime() -
      new Date(a.published_at || a.created_at || 0).getTime()
  );
}

function normalizeFilteredPosts(rows: RawNewsletterSummary[], indexOffset = 0): NewsletterCardPost[] {
  return rows
    .filter((p) => p.slug && p.subject && (p.published_at || p.created_at) && isOmniAiNewsletterPost(p))
    .map((p, index) => normalizePost(p, index + indexOffset));
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

async function getArchivePosts(): Promise<{ posts: NewsletterCardPost[]; unavailable: boolean }> {
  const supabase = createAdminClient();
  const result = await withTimeout(
    supabase
      .from("newsletter_posts")
      .select("slug, subject, intro, keywords, tier, published_at, created_at")
      .or("published_at.not.is.null,status.eq.published")
      .order("published_at", { ascending: false })
      .limit(500),
    4000
  );
  const rows = (result as { data?: RawNewsletterSummary[]; error?: unknown } | null)?.data || [];
  const fallbackPosts = normalizeFilteredPosts(getNewsletterFallbackSummaries() as RawNewsletterSummary[]);
  const livePosts = normalizeFilteredPosts(rows);
  const posts = mergeNewsletterPosts(livePosts, fallbackPosts);

  return {
    posts,
    unavailable: !result || Boolean((result as { error?: unknown }).error),
  };
}

export default async function NewsletterArchivePage() {
  const { posts, unavailable } = await getArchivePosts();
  const premiumPosts = posts.filter((p) => p.tier === "premium");
  const freePosts = posts.filter((p) => p.tier !== "premium");

  return (
    <div className="min-h-screen text-white relative">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "https://omnileadsagi.com/" },
          { name: "Newsletter", url: "https://omnileadsagi.com/newsletter" },
          { name: "Archive", url: "https://omnileadsagi.com/newsletter/archive" },
        ])}
      />
      {posts.length > 0 && (
        <JsonLd
          data={itemListSchema({
            name: "Interlinked Newsletter Archive",
            description:
              "Full archive of Interlinked newsletter issues from Omni AI.",
            url: "https://omnileadsagi.com/newsletter/archive",
            items: posts.slice(0, 50).map((p) => ({
              name: p.subject,
              url: `https://omnileadsagi.com/newsletter/${p.slug}`,
              description: (p.intro || "").slice(0, 160) || undefined,
            })),
          })}
        />
      )}
      <NewsletterHeader />

      <main className="relative z-10 max-w-5xl mx-auto px-5 py-12 md:py-20">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Newsletter", href: "/newsletter" },
            { name: "Archive", href: "/newsletter/archive" },
          ]}
          className="mb-6"
        />

        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
            Full Library
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Interlinked Archive
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-400">
            Every Omni AI intelligence issue in one place. The front page stays fast; the full library lives here.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/newsletter"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              Latest issues
            </Link>
            <a
              href="/newsletter/rss.xml"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              RSS
            </a>
          </div>
        </div>

        {unavailable && (
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            Live newsletter data is reconnecting, so this archive is using the protected fallback snapshot.
          </div>
        )}

        <section className="mb-14">
          <div className="mb-6 flex items-center gap-4">
            <h2 className="text-xl font-bold text-amber-400">Interlinked</h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Interlinked Premium
            </span>
          </div>
          <div className="grid gap-5">
            {premiumPosts.map((post) => (
              <NewsletterIssueCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center gap-4">
            <h2 className="text-xl font-bold text-amber-400">Daily Intelligence</h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Interlinked Free
            </span>
          </div>
          <div className="grid gap-5">
            {freePosts.map((post) => (
              <NewsletterIssueCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        {posts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-gray-500">
            No newsletter issues are available right now.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
