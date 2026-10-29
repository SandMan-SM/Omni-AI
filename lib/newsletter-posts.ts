/**
 * The canonical public-read filter for `newsletter_posts`.
 *
 * Why this file exists:
 *   `newsletter_posts` carries TWO publication markers and a row is public
 *   only when BOTH agree:
 *
 *     status        text         DEFAULT 'draft'
 *     published_at  timestamptz  DEFAULT now()
 *
 *   A row with `status = 'draft'` and `published_at` set is a half-published
 *   row. It looks published in the database, in every log, and in the admin
 *   panel — but `/newsletter/[slug]` filters on `status = 'published'`, so
 *   the issue 404s.
 *
 *   That combination is not theoretical: the table currently holds 325 rows
 *   that are draft-with-a-date and 88 that are genuinely published. Every
 *   reader that decided "this row is public" from `published_at` alone
 *   advertised slugs that 404 — the RSS feed, the Google News sitemap,
 *   `llms.txt`, on-site search, and the cross-cluster link on the daily
 *   landing pages. `app/sitemap.ts` was already fixed for this reason (see
 *   the comment there); the rest of the surfaces were not.
 *
 * The rule this module encodes: **a post is public when
 * `status = 'published' AND published_at IS NOT NULL`.** A reader that wants
 * public posts applies `publishedNewsletterOnly()`; a reader that wants
 * drafts (the studio, the admin history, the sender) deliberately does not,
 * and says so in a comment.
 *
 * `scripts/audit-publish-state.ts` enforces this statically — a chain that
 * constrains `published_at` without constraining `status` fails the build.
 */

/**
 * The minimal shape `publishedNewsletterOnly` needs. Supabase's query
 * builders satisfy it structurally, so callers keep the concrete builder
 * type (and can chain `.order()`, `.limit()`, `.abortSignal()` …) afterwards.
 *
 * The parameter is deliberately NOT constrained to this shape in the
 * signature: a recursive structural constraint against Supabase's self-typed
 * builder (`eq(...): this`) makes TypeScript give up with "type
 * instantiation is excessively deep". The cast preserves the caller's own
 * type without paying that cost.
 */
type NewsletterFilterChain = {
  eq(column: string, value: string): { not(column: string, operator: "is", value: null): unknown };
};

/**
 * Restrict a `newsletter_posts` query to the rows that are actually public.
 *
 * @example
 *   const { data } = await publishedNewsletterOnly(
 *     supabase.from("newsletter_posts").select("slug, subject"),
 *   ).order("published_at", { ascending: false });
 */
export function publishedNewsletterOnly<T>(query: T): T {
  const chain = query as unknown as NewsletterFilterChain;
  return chain.eq("status", "published").not("published_at", "is", null) as unknown as T;
}
