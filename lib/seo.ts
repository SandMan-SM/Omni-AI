import type { Metadata } from "next";

/**
 * lib/seo.ts — single source of truth for Next.js page metadata.
 *
 * Why this exists:
 *  The "seo-metadata-nextjs" pattern (title, description, canonical,
 *  OpenGraph, Twitter) was hand-rolled per page, which meant dozens of
 *  routes had no `<title>`/`<description>` at all — a client page with
 *  no title renders the raw path in the SERP and in the browser tab,
 *  which reads as a broken page to both crawlers and operators.
 *
 *  Centralizing the shape here means:
 *   - every route gets canonical + OG + Twitter from one call
 *   - the site URL, OG image route, and card dimensions are declared
 *     once, so a brand change propagates everywhere
 *   - internal surfaces (dashboard / admin / command) get `noindex`
 *     by construction instead of by remembering to add it
 *
 * Reusable across client projects — copy the file and change SITE_URL.
 */

export const SITE_URL = "https://omnileadsagi.com";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

type OgType = "website" | "article" | "profile";

export type BuildMetadataOptions = {
  /** Route path with a leading slash, e.g. "/pricing". Canonical + og:url. */
  path: string;
  /** Absolute page title, e.g. "Pricing | Omni AI — Free Tier + Paid Tiers". */
  title: string;
  /** 50–160 char meta description. */
  description: string;
  /** Optional keyword list. */
  keywords?: string[];
  /** OpenGraph type. Defaults to "website". */
  type?: OgType;
  /** OpenGraph/Twitter headline. Defaults to `title`. */
  socialTitle?: string;
  /** OpenGraph/Twitter description. Defaults to `description`. */
  socialDescription?: string;
  /** Alt text for the generated OG card. */
  imageAlt?: string;
  /** Headline rendered on the generated OG card. */
  imageTitle?: string;
  /** Sub-headline rendered on the generated OG card. */
  imageTopic?: string;
  /** Eyebrow line rendered on the generated OG card. */
  imageEyebrow?: string;
  /** Set true for internal / authenticated surfaces. */
  noindex?: boolean;
};

/**
 * Builds the generated OG card URL. The card is rendered by the edge
 * route at /api/og, so the URL is content-addressable — the same
 * title/topic/eyebrow always yields the same image, which keeps the
 * OG URL stable enough for crawlers to cache.
 */
export function ogImageUrl({
  title,
  topic,
  eyebrow,
}: {
  title: string;
  topic?: string;
  eyebrow?: string;
}): string {
  const params = new URLSearchParams({ title });
  if (topic) params.set("topic", topic);
  if (eyebrow) params.set("eyebrow", eyebrow);
  return `${SITE_URL}/api/og?${params.toString()}`;
}

/**
 * Standard metadata export factory.
 *
 * Every page in the app should route through this so the shape stays
 * uniform: absolute title, real description, canonical URL, OpenGraph
 * with a 1200×630 card, and a Twitter summary_large_image card.
 */
export function buildMetadata({
  path,
  title,
  description,
  keywords,
  type = "website",
  socialTitle,
  socialDescription,
  imageAlt,
  imageTitle,
  imageTopic,
  imageEyebrow,
  noindex = false,
}: BuildMetadataOptions): Metadata {
  const pageUrl = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const ogTitle = socialTitle ?? title;
  const ogDescription = socialDescription ?? description;
  const ogImage = ogImageUrl({
    title: imageTitle ?? socialTitle ?? title,
    topic: imageTopic,
    eyebrow: imageEyebrow,
  });

  return {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: pageUrl },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: pageUrl,
      siteName: "Omni AI",
      locale: "en_US",
      type,
      images: [
        {
          url: ogImage,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: imageAlt ?? ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
      site: "@SitaniMafi",
      creator: "@SitaniMafi",
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true },
        },
  };
}
