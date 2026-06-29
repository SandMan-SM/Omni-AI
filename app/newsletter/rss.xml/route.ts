import { createAdminClient } from "@/lib/supabase/admin";
import { getNewsletterFallbackSummaries, isOmniAiNewsletterPost } from "@/lib/newsletter-fallback";
import { unstable_noStore as noStore } from "next/cache";

/**
 * RSS 2.0 feed for the Interlinked newsletter at /newsletter/rss.xml.
 *
 * Three reasons this exists:
 *  1. LLM crawlers (SearchGPT, Claude Web, Perplexity) preferentially
 *     discover periodic content via feeds — the sitemap lists URLs but
 *     doesn't signal "this is an active publication". A named RSS feed
 *     with <pubDate> on every item is the canonical freshness signal.
 *  2. B2B readers routing content into Feedly / Inoreader / Reeder need
 *     a feed endpoint — otherwise they literally can't subscribe.
 *  3. Auto-discovery via <link rel="alternate" type="application/rss+xml">
 *     in /newsletter and /newsletter/[slug] heads lets browsers + feed
 *     readers pick up the feed without a manual URL paste.
 *
 * ISR hourly. Newsletter drops at 8 AM ET; 1-hour resolution is more than
 * fine and it keeps Supabase round-trips off the hot path.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const siteUrl = "https://omnileadsagi.com";
const feedUrl = `${siteUrl}/newsletter/rss.xml`;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// RSS 2.0 is conservative about which characters must be escaped inside
// text nodes. XML requires &, <, > at minimum; attributes also need " and '.
// We're only writing into <title>/<description>/<category> text nodes,
// but escape all five anyway to keep the helper safe for future attribute
// interpolation.
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function archiveDateForIndex(index: number): string {
  const date = new Date(Date.UTC(2026, 4, 31, 14, 0, 0));
  date.setUTCDate(date.getUTCDate() - index);
  return date.toISOString();
}

export async function GET() {
  noStore();
  const supabase = createAdminClient();
  const result = await withTimeout(
    supabase
      .from("newsletter_posts")
      .select("slug, subject, intro, keywords, published_at, created_at, tier")
      // Keep this aligned with /api/newsletter/posts. `published_at` is
      // the stable public-publish marker; adding newer/optional columns to
      // the public RSS query can make PostgREST reject the whole request and
      // produce a false-green empty feed while the API/archive still have rows.
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(50),
    8000
  );

  const queryResult = result as {
    data?: Array<{
      slug?: string | null;
      subject?: string | null;
      intro?: string | null;
      keywords?: unknown;
      published_at?: string | null;
      created_at?: string | null;
      tier?: string | null;
    }> | null;
    error?: unknown;
  } | null;
  if (queryResult?.error) {
    console.error("[newsletter/rss] Supabase lookup failed:", queryResult.error);
  }

  const supabasePosts = queryResult?.data || [];
  const posts = (supabasePosts.length > 0 ? supabasePosts : getNewsletterFallbackSummaries())
    .filter(isOmniAiNewsletterPost)
    .map((p, index) => ({
      ...p,
      published_at: p.published_at || archiveDateForIndex(index),
    }));
  const latestPub = posts[0]?.published_at
    ? new Date(posts[0].published_at).toUTCString()
    : new Date().toUTCString();

  const items = posts
    .filter((p) => p.slug && p.published_at)
    .map((p) => {
      const pubDate = new Date(p.published_at as string).toUTCString();
      const tierCategory = p.tier === "premium" ? "Premium" : "Free";
      // <author> uses the RSS 2.0 canonical format: "email (Name)".
      // <dc:creator> duplicates the author name without the email for
      // feed readers (Inoreader, Feedly, Reeder) that display author
      // attribution prominently but intentionally hide raw emails for
      // privacy. Shipping both is belt-and-suspenders — every major
      // reader picks up at least one. The Dublin Core namespace is
      // declared on the <rss> root below.
      return `    <item>
      <title>${escapeXml(p.subject || p.slug!)}</title>
      <link>${siteUrl}/newsletter/${p.slug}</link>
      <guid isPermaLink="true">${siteUrl}/newsletter/${p.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.intro || "")}</description>
      <author>alfred@omnileadsagi.com (Alfred Belvedere)</author>
      <dc:creator>Alfred Belvedere</dc:creator>
      <category>${tierCategory}</category>
    </item>`;
    })
    .join("\n");

  const copyrightYear = new Date().getUTCFullYear();

  // Channel-level metadata upgrades (the block between <channel> and <item>):
  //  - <managingEditor> / <webMaster>: canonical RSS 2.0 publisher contacts.
  //    Feed validators (W3C Feed Validator, RSS Board) flag a feed without
  //    these as "missing recommended fields" — a minor but real quality
  //    signal to LLM crawlers that sniff feed metadata for authority.
  //  - <copyright>: required for some news-aggregator ingestion (Apple News,
  //    NewsData.io) and a trust signal for LLMs — content with explicit
  //    copyright declarations is more quotable without attribution anxiety.
  //  - <generator>: tells feed readers what produced the feed. Debugging
  //    aid + a small brand signal.
  //  - <ttl>: time-to-live in MINUTES (not seconds — RSS 2.0 spec). 60
  //    matches the 1-hour revalidate window; polite feed readers will wait
  //    at least this long between polls, reducing Supabase read pressure
  //    during burst subscription events.
  //  - <docs>: points to the RSS 2.0 spec. A no-op for humans, but RSS
  //    parsers sometimes check for this and treat its presence as a
  //    "well-formed modern feed" signal.
  //  - <image>: channel icon for feed readers (Feedly / Inoreader render
  //    this as the subscription thumbnail). Without it the feed shows a
  //    generic "broken image" placeholder — a real branding cost for a
  //    newsletter trying to build reader habit.
  //  - <category>: topical classification. Used by news aggregators for
  //    routing + by LLM crawlers for retrieval clustering.
  //
  // The `dc:` namespace on the <rss> root enables <dc:creator> inside
  // items. Keep both xmlns declarations — removing atom: would break the
  // <atom:link rel="self"> tag that the RSS 2.0 best-practices spec
  // requires for self-referential feeds.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Interlinked — Omni AI Newsletter</title>
    <link>${siteUrl}/newsletter</link>
    <description>Daily AI strategy, intelligence, and signals from Omni AI. Built for operators running autonomous lead-gen systems.</description>
    <language>en-us</language>
    <copyright>© ${copyrightYear} Omni Leads LLC. All rights reserved.</copyright>
    <managingEditor>alfred@omnileadsagi.com (Alfred Belvedere)</managingEditor>
    <webMaster>alfred@omnileadsagi.com (Alfred Belvedere)</webMaster>
    <generator>Next.js RSS (Omni AI)</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <category>AI</category>
    <category>Business Automation</category>
    <category>Lead Generation</category>
    <image>
      <url>${siteUrl}/favicon.png</url>
      <title>Interlinked — Omni AI Newsletter</title>
      <link>${siteUrl}/newsletter</link>
    </image>
    <lastBuildDate>${latestPub}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Keep the feed aligned with /api/newsletter/posts. RSS is the public
      // freshness signal, so serving yesterday's cached XML after a publish
      // makes the whole newsletter look stale even when the DB is correct.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
