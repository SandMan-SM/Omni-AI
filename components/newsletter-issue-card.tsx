import Link from "next/link";

export type NewsletterCardPost = {
  slug: string;
  subject: string;
  intro: string;
  keywords: string[] | string | null;
  tier: string;
  published_at: string;
  created_at?: string;
};

export function normalizeNewsletterKeywords(keywords: unknown): string[] {
  if (Array.isArray(keywords)) return keywords.filter((kw): kw is string => typeof kw === "string");
  if (typeof keywords === "string") {
    return keywords
      .split(",")
      .map((kw) => kw.trim())
      .filter(Boolean);
  }
  return [];
}

export function newsletterIssueImageUrl(slug: string): string {
  return `/newsletter/generated/${encodeURIComponent(slug)}.webp`;
}

export function newsletterIssueBackgroundImage(slug: string): string {
  return `url("${newsletterIssueImageUrl(slug)}"), url("/newsletter/generated/default.webp")`;
}

export function NewsletterIssueCard({
  post,
  href,
  locked = false,
}: {
  post: NewsletterCardPost;
  href?: string;
  locked?: boolean;
}) {
  const date = new Date(post.published_at || post.created_at || new Date()).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const tagsToShow = normalizeNewsletterKeywords(post.keywords).slice(0, 4);
  const isPremium = post.tier === "premium";
  const targetHref = href || `/newsletter/${post.slug}`;

  return (
    <Link
      href={targetHref}
      className="group relative block overflow-hidden rounded-xl border border-amber-500/[0.14] bg-amber-500/[0.03] shadow-[0_0_24px_rgba(245,158,11,0.04)] transition-all hover:border-amber-500/35 hover:shadow-[0_0_32px_rgba(245,158,11,0.12)]"
    >
      <div className="relative aspect-[1200/630] min-h-[240px] bg-black">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.025]"
          style={{ backgroundImage: newsletterIssueBackgroundImage(post.slug) }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.70)_42%,rgba(0,0,0,0.34)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-700" />
        <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
              {isPremium ? "Premium" : "Free"}
            </span>
            <span className="text-xs text-gray-400">{date}</span>
          </div>

          <div className="max-w-2xl">
            <h3 className="text-xl font-bold leading-tight text-amber-300 transition-colors group-hover:text-amber-200 sm:text-2xl">
              {post.subject}
            </h3>
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-300 sm:text-base">
              {post.intro}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {locked && (
                <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                  Preview
                </span>
              )}
              {tagsToShow.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] text-gray-300 backdrop-blur-sm"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
