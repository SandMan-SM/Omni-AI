import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

// ISR the sitemap hourly. The content pages themselves are `force-dynamic`,
// but the sitemap is a discovery manifest — per-request DB hits are wasteful
// and rebuild-on-publish is good enough for the daily posting cadence.
export const revalidate = 3600;

const baseUrl = "https://omnileadsagi.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/campaigns`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/details`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/arena`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/arena/info`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/interlinked`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/sponsor`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/sponsor/info`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/fray`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/newsletter`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/newsletter/premium/info`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/website/development`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Legal — low crawl priority, rarely changes. Included so the URL is
    // discoverable by search engines and LLM indexers (required signal for
    // E-E-A-T / trust rating on commercial sites).
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Pull dynamic rows in parallel. Fail-soft: if either query errors we still
  // return the static sitemap rather than 500-ing the whole manifest. A bad
  // sitemap response is worse than a sitemap with fewer URLs.
  let landingRows: { slug: string; date: string | null }[] = [];
  let newsletterRows: {
    slug: string;
    published_at: string | null;
  }[] = [];

  try {
    const supabase = createAdminClient();
    const [landingRes, newsletterRes] = await Promise.all([
      supabase
        .from("landing_pages")
        .select("slug, date")
        .order("date", { ascending: false })
        .limit(5000),
      // newsletter_posts has no updated_at column — only published_at. If we
      // select updated_at Supabase returns an error and the table drops out
      // of the sitemap entirely.
      supabase
        .from("newsletter_posts")
        .select("slug, published_at")
        .not("slug", "is", null)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(5000),
    ]);
    if (!landingRes.error && landingRes.data) landingRows = landingRes.data;
    if (!newsletterRes.error && newsletterRes.data) newsletterRows = newsletterRes.data;
  } catch {
    // Swallow — static sitemap still returns.
  }

  const landingPages: MetadataRoute.Sitemap = landingRows
    .filter((r) => r.slug)
    .map((r) => ({
      url: `${baseUrl}/${r.slug}`,
      lastModified: r.date ? new Date(r.date).toISOString() : now,
      changeFrequency: "daily",
      priority: 0.7,
    }));

  const newsletterPages: MetadataRoute.Sitemap = newsletterRows
    .filter((r) => r.slug)
    .map((r) => ({
      url: `${baseUrl}/newsletter/${r.slug}`,
      lastModified: r.published_at
        ? new Date(r.published_at).toISOString()
        : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [...staticPages, ...landingPages, ...newsletterPages];
}
