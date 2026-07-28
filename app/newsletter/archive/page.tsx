import { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/breadcrumb";
import { Footer } from "@/components/footer";
import { JsonLd, breadcrumbSchema, itemListSchema } from "@/components/json-ld";
import { NewsletterHeader } from "@/components/newsletter-premium-gate";
import {
  NewsletterIssueCard,
  normalizeNewsletterKeywords,
  type NewsletterCardPost,
} from "@/components/newsletter-issue-card";
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

type Props = {
  searchParams?: {
    tag?: string | string[];
  };
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

function normalizeTagSlug(tag: string): string {
  return tag.trim().toLowerCase();
}

function resolveSelectedTag(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 80);
  return trimmed || null;
}

function postHasTag(post: NewsletterCardPost, tag: string): boolean {
  const selected = normalizeTagSlug(tag);
  return normalizeNewsletterKeywords(post.keywords).some(
    (kw) => normalizeTagSlug(kw) === selected,
  );
}

function archiveTagHref(tag: string | null): string {
  return tag ? `/newsletter/archive?tag=${encodeURIComponent(tag)}` : "/newsletter/archive";
}

function buildTagFilters(posts: NewsletterCardPost[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const post of posts) {
    for (const keyword of normalizeNewsletterKeywords(post.keywords)) {
      const label = keyword.trim();
      if (!label) continue;
      const key = normalizeTagSlug(label);
      const current = counts.get(key);
      counts.set(key, {
        label: current?.label || label,
        count: (current?.count || 0) + 1,
      });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 18);
}

async function getArchivePosts(): Promise<{ posts: NewsletterCardPost[]; unavailable: boolean }> {
  const supabase = createAdminClient();
  const result = await withTimeout(
    supabase
      .from("newsletter_posts")
      .select("slug, subject, intro, keywords, tier, published_at, created_at")
      .eq("status", "published")
      .not("published_at", "is", null)
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

export default async function NewsletterArchivePage({ searchParams }: Props) {
  const { posts, unavailable } = await getArchivePosts();
  const selectedTag = resolveSelectedTag(searchParams?.tag);
  const tagFilters = buildTagFilters(posts);
  const visiblePosts = selectedTag
    ? posts.filter((post) => postHasTag(post, selectedTag))
    : posts;
  const visibleTagFilters = tagFilters.slice(0, 5);
  const overflowTagFilters = tagFilters.slice(5);
  const premiumPosts = visiblePosts.filter((p) => p.tier === "premium");
  const freePosts = visiblePosts.filter((p) => p.tier !== "premium");

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
            items: visiblePosts.slice(0, 50).map((p) => ({
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
          {tagFilters.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Link
                href={archiveTagHref(null)}
                className={`inline-flex h-10 min-w-0 items-center justify-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.18)] transition-colors sm:h-9 sm:w-auto sm:px-3.5 sm:tracking-[0.14em] ${
                  selectedTag
                    ? "border-sky-300/15 bg-slate-950/70 text-slate-300 hover:border-amber-400/35 hover:text-amber-200"
                    : "border-amber-300/55 bg-amber-300/15 text-amber-100"
                }`}
              >
                All
              </Link>
              {visibleTagFilters.map((tag) => {
                const isActive =
                  selectedTag &&
                  normalizeTagSlug(selectedTag) === normalizeTagSlug(tag.label);
                return (
                  <Link
                    key={tag.label}
                    href={archiveTagHref(tag.label)}
                    className={`inline-flex h-10 min-w-0 max-w-full items-center justify-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.18)] transition-colors sm:h-9 sm:w-auto sm:px-3.5 sm:tracking-[0.14em] ${
                      isActive
                        ? "border-amber-300/55 bg-amber-300/15 text-amber-100"
                        : "border-sky-300/15 bg-slate-950/70 text-slate-300 hover:border-amber-400/35 hover:text-amber-200"
                    }`}
                  >
                    <span className="truncate">{tag.label}</span>
                    <span className="ml-1 text-[10px] opacity-60">{tag.count}</span>
                  </Link>
                );
              })}
              {overflowTagFilters.length > 0 && (
                <details className="group relative col-span-2 sm:col-span-1">
                  <summary className="inline-flex h-10 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-sky-300/15 bg-slate-950/70 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_22px_rgba(0,0,0,0.18)] transition-colors hover:border-amber-400/35 hover:text-amber-200 sm:h-9 sm:w-auto sm:px-3.5 sm:tracking-[0.14em] [&::-webkit-details-marker]:hidden">
                    More topics
                    <ChevronDown
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="absolute left-0 right-0 z-20 mt-2 grid max-h-80 gap-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur sm:left-auto sm:w-[min(84vw,360px)]">
                    {overflowTagFilters.map((tag) => {
                      const isActive =
                        selectedTag &&
                        normalizeTagSlug(selectedTag) === normalizeTagSlug(tag.label);
                      return (
                        <Link
                          key={tag.label}
                          href={archiveTagHref(tag.label)}
                          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                            isActive
                              ? "bg-amber-300/15 text-amber-100"
                              : "text-slate-300 hover:bg-white/[0.06] hover:text-amber-200"
                          }`}
                        >
                          <span className="truncate">{tag.label}</span>
                          <span className="shrink-0 text-[10px] opacity-60">{tag.count}</span>
                        </Link>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {unavailable && (
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
            Live newsletter data is reconnecting, so this archive is using the protected fallback snapshot.
          </div>
        )}

        {premiumPosts.length > 0 && (
          <section className="mb-14">
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-xl font-bold text-amber-400">Interlinked</h2>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Interlinked Premium
              </span>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {premiumPosts.map((post) => (
                <div
                  key={post.slug}
                  className="w-[78vw] max-w-[340px] shrink-0 snap-start"
                >
                  <NewsletterIssueCard post={post} />
                </div>
              ))}
            </div>
          </section>
        )}

        {freePosts.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-xl font-bold text-amber-400">Daily Intelligence</h2>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                Interlinked Free
              </span>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {freePosts.map((post) => (
                <div
                  key={post.slug}
                  className="w-[78vw] max-w-[340px] shrink-0 snap-start"
                >
                  <NewsletterIssueCard post={post} />
                </div>
              ))}
            </div>
          </section>
        )}

        {visiblePosts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-gray-500">
            {selectedTag
              ? `No newsletter issues match "${selectedTag}" yet.`
              : "No newsletter issues are available right now."}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
