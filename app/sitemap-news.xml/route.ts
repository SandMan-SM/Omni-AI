import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Google News sitemap at /sitemap-news.xml.
 *
 * Why a second sitemap file:
 *  1. Google News Top Stories eligibility keys off a separately-submitted
 *     news sitemap (xmlns:news="http://www.google.com/schemas/sitemap-news/0.9").
 *     The main /sitemap.xml lists everything; the news sitemap narrows to
 *     recent articles so Top Stories doesn't have to scan thousands of
 *     landing pages every crawl.
 *  2. LLM "latest news" retrieval (Perplexity "News", Claude with search,
 *     ChatGPT Search) preferentially pulls from news-sitemap-tagged URLs
 *     the same way Google News does. Shipping the file puts the daily
 *     Interlinked post and the daily trending landing page directly in
 *     the retrieval window those surfaces scan first.
 *  3. Google News sitemap spec requires a 48-hour recency cap — articles
 *     older than 2 days must be removed. The ISR revalidate keeps the
 *     file on a schedule tight enough that stale entries don't linger.
 *
 * Contents:
 *  - newsletter_posts (NewsArticle-typed on-site) from the last 48h —
 *    these are the canonical "news" surface.
 *  - landing_pages (Article-typed) from the last 48h — daily trending-
 *    topic posts qualify as news-style content (viral, dated, time-
 *    sensitive). Google accepts Article-typed pages in news sitemaps
 *    as long as they meet the recency + newsworthy criteria.
 *
 * ISR 30 minutes — tighter than the main sitemap because the 48h window
 * means an hour of staleness eats measurable retrieval time for the
 * freshest post.
 */

export const revalidate = 1800;
export const dynamic = "force-dynamic";

const siteUrl = "https://omnileadsagi.com";
const publicationName = "Omni AI — Interlinked";
const publicationLanguage = "en";

// XML text-node escaping — same list RSS uses. Keeps `&`, `<`, `>`, `"`,
// `'` safe inside <news:title>, <news:name>, and <loc> bodies.
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

  // 48-hour recency window enforced at the query boundary so the response
  // never has to filter client-side. Google's spec is strict on the
  // window — articles older than 2 days must not appear in a news
  // sitemap or the whole file can be demoted.
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [newsletterRes, landingRes] = await Promise.all([
    supabase
      .from("newsletter_posts")
      .select("slug, subject, published_at")
      .not("published_at", "is", null)
      .gte("published_at", cutoff)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(200),
    supabase
      .from("landing_pages")
      .select("slug, title, topic, date")
      .not("slug", "is", null)
      .gte("date", cutoff)
      .order("date", { ascending: false })
      .limit(200),
  ]);

  type NewsEntry = {
    loc: string;
    title: string;
    publicationDate: string;
  };

  const entries: NewsEntry[] = [];

  for (const p of newsletterRes.data || []) {
    if (!p.slug || !p.published_at) continue;
    entries.push({
      loc: `${siteUrl}/newsletter/${p.slug}`,
      title: p.subject || p.slug,
      publicationDate: new Date(p.published_at).toISOString(),
    });
  }

  for (const p of landingRes.data || []) {
    if (!p.slug || !p.date) continue;
    entries.push({
      loc: `${siteUrl}/${p.slug}`,
      title: p.title || p.topic || p.slug,
      publicationDate: new Date(p.date).toISOString(),
    });
  }

  const urlBlocks = entries
    .map(
      (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(publicationName)}</news:name>
        <news:language>${publicationLanguage}</news:language>
      </news:publication>
      <news:publication_date>${e.publicationDate}</news:publication_date>
      <news:title>${escapeXml(e.title)}</news:title>
    </news:news>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlBlocks}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Short TTL than the main sitemap (30 min edge) because the 48h
      // recency window makes even moderate staleness costly for retrieval
      // freshness. stale-while-revalidate keeps the file available during
      // Supabase hiccups without breaking the Google News fetch cycle.
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
