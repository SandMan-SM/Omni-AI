import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPARISON_SLUGS } from "@/lib/comparison-data";

// ISR the sitemap hourly. The content pages themselves are `force-dynamic`,
// but the sitemap is a discovery manifest — per-request DB hits are wasteful
// and rebuild-on-publish is good enough for the daily posting cadence.
export const revalidate = 3600;

const baseUrl = "https://omnileadsagi.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // /vs/[competitor] pages — programmatic comparison cluster driven by
  // lib/comparison-data.ts. Adding a new competitor there auto-appends
  // to the sitemap without a second edit here.
  const comparisonPages: MetadataRoute.Sitemap = COMPARISON_SLUGS.map((slug) => ({
    url: `${baseUrl}/vs/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/campaigns`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/details`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/arena`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/arena/info`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/interlinked`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    // /manifesto — the canonical Interlinked manifesto. Long-form essay
    // tying Omni AI + Live Better Podcast + CPS under a single thread;
    // shareable with Open Graph + Twitter card.
    { url: `${baseUrl}/manifesto`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/system`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/oracle`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/join`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // /sponsor is intentionally omitted — it's a logged-in sponsor portal
    // (live build-log / MRR / ship history for authenticated sponsors), not
    // a public marketing page. app/sponsor/layout.tsx sets robots:
    // noindex,nofollow. /sponsor/info below is the canonical public
    // marketing surface for the sponsor program; /sponsor/application
    // is the public apply form. Sponsor funnel: /sponsor/info → /sponsor/
    // application → /sponsor (portal, unlisted).
    { url: `${baseUrl}/sponsor/info`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Public sponsor apply form — ships Service + OfferCatalog + RegisterAction
    // schema (app/sponsor/application/layout.tsx) and a full conversion flow.
    // The funnel comment above calls this page out as public, but the sitemap
    // was missing it entirely, so Google / LLM crawlers had no direct path
    // from a head-intent "sponsor Omni AI" search into the apply form —
    // they could only land on /sponsor/info first and then follow the CTA.
    // Priority 0.5 matches /sponsor/info (both are the same conversion
    // surface at different stages of the funnel).
    { url: `${baseUrl}/sponsor/application`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // /fray is intentionally omitted — it's a personalized VIP sponsor
    // dashboard ("Hey Fray 👋" header; live-build status / MRR / leads /
    // newsletter activity for 3 sponsored businesses). Not a public
    // marketing page; app/fray/layout.tsx sets robots: noindex,nofollow.
    // Same pattern as /sponsor above.
    { url: `${baseUrl}/newsletter`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/newsletter/premium/info`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/website/development`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Core conversion surface — consultation booking page with written reviews
    // and value content. Weekly refresh since availability/pricing can change.
    { url: `${baseUrl}/book-now`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    // Commercial-intent head query target — catches "Omni AI pricing" /
    // "Omni AI cost" searches that previously had no landing page. FAQPage
    // schema inline + tier cards feed the rich result.
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    // Premium newsletter sales landing — distinct from /newsletter/premium/info
    // (feature list) and a direct conversion target for paid traffic.
    { url: `${baseUrl}/interlinked/premium`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Affiliate program surfaces. /info is the program overview, sign-up and
    // book-consultation are modal-opening landers that still deserve a URL
    // because they're the canonical entry points from email/ad creative.
    { url: `${baseUrl}/affiliate/info`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/affiliate/consultation/info`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/affiliate/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/affiliate/book-consultation`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    // Comparison hub — parent page for the /vs/[competitor] cluster.
    // Catches "Omni AI alternatives" / "Omni AI comparison" head-intent
    // queries that don't name a specific competitor.
    { url: `${baseUrl}/vs`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // Legal — low crawl priority, rarely changes. Included so the URL is
    // discoverable by search engines and LLM indexers (required signal for
    // E-E-A-T / trust rating on commercial sites).
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // Sitewide search endpoint. Paired with the SearchAction potentialAction
    // declared in websiteSchema — Google's Sitelinks Searchbox rich result
    // only renders when the schema's target URL is a real, crawlable page.
    // Low priority (not a destination surface) but indexable so the
    // endpoint is discoverable to the search-engine parsers validating
    // the Searchbox schema.
    { url: `${baseUrl}/search`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
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

  return [...staticPages, ...comparisonPages, ...landingPages, ...newsletterPages];
}
