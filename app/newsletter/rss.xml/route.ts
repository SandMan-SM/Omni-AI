import { createAdminClient } from "@/lib/supabase/admin";

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

export const revalidate = 3600;

const siteUrl = "https://omnileadsagi.com";
const feedUrl = `${siteUrl}/newsletter/rss.xml`;

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

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("newsletter_posts")
    .select("slug, subject, intro, published_at, tier")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(50);

  const posts = data || [];
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
    <copyright>© ${copyrightYear} Omni AI LLC. All rights reserved.</copyright>
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
      // Edge cache for an hour, serve stale for a day while revalidating.
      // Keeps feed readers polite under burst load and survives a Supabase
      // hiccup without 500-ing the feed.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
