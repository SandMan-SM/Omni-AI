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
  return `/newsletter/${encodeURIComponent(slug)}/opengraph-image`;
}

export function newsletterIssueBackgroundImage(slug: string): string {
  return `url("${newsletterIssueImageUrl(slug)}")`;
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
  const tagsToShow = normalizeNewsletterKeywords(post.keywords).slice(0, 3);
  const isPremium = post.tier === "premium";
  const targetHref = href || `/newsletter/${post.slug}`;
  const tierLabel = isPremium ? "Interlinked Premium" : "Interlinked Free";

  return (
    <Link
      href={targetHref}
      className="group relative block w-full min-w-0 overflow-hidden rounded-xl border border-amber-500/[0.14] bg-amber-500/[0.03] shadow-[0_0_24px_rgba(245,158,11,0.04)] transition-all hover:border-amber-500/35 hover:shadow-[0_0_32px_rgba(245,158,11,0.12)]"
    >
      <div className="relative min-h-[350px] bg-black sm:aspect-[1200/630] sm:min-h-[270px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.025]"
          style={{ backgroundImage: newsletterIssueBackgroundImage(post.slug) }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.82)_58%,rgba(0,0,0,0.48)_100%)] sm:bg-[linear-gradient(90deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.70)_42%,rgba(0,0,0,0.34)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-700" />
        <div className="relative flex h-full min-w-0 flex-col justify-between p-5 sm:p-7">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <span className="max-w-[70%] shrink truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              {tierLabel}
            </span>
            <span className="text-xs text-gray-400">{date}</span>
          </div>

          <div className="min-w-0 max-w-full sm:max-w-2xl">
            <h3 className="line-clamp-3 max-w-full whitespace-normal break-words text-[1.35rem] font-bold leading-tight text-amber-300 transition-colors group-hover:text-amber-200 sm:line-clamp-2 sm:text-2xl">
              {post.subject}
            </h3>
            <p className="mt-3 line-clamp-3 max-w-full break-words text-sm leading-relaxed text-gray-300 sm:line-clamp-2 sm:text-base">
              {post.intro}
            </p>
            <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden">
              {/* Keep the tag row identical for premium and free cards.
                  The lock state only changes the destination URL; it must not
                  add a transient “Preview” pill or alter card formatting when
                  new posts are generated. */}
              {tagsToShow.map((kw) => (
                <span
                  key={kw}
                  className="max-w-full truncate rounded-md border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] text-gray-300 backdrop-blur-sm"
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
