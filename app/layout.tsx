import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
  softwareSchema,
  siteNavigationSchema,
} from "@/components/json-ld";
import { SpaceBackdrop } from "@/components/space-backdrop";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { ErrorTelemetry } from "@/components/error-telemetry";

// display:swap — render fallback font immediately and swap to Inter
// once it loads. Prevents FOIT (flash of invisible text) on slow
// connections where the hero headline would otherwise sit blank for
// 100–300ms. CLS stays in check because adjustFontFallback (Next 14
// default) size-matches the metric fallback to Inter.
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://omnileadsagi.com"),
  title: "Omni AI — Autonomous Lead Generation & Agentic Infrastructure",
  description: "Omni AI builds autonomous AI systems that generate leads, run operations, and scale businesses 24/7. Explore AI-powered campaigns, lead qualification, and real-time optimization.",
  keywords: ["AI lead generation", "autonomous AI", "AI business automation", "marketing automation", "AI agents", "lead qualification", "AI campaigns"],
  alternates: {
    canonical: "https://omnileadsagi.com",
    // Sitewide RSS auto-discovery. Before this the <link rel="alternate"
    // type="application/rss+xml"> tag only rendered on /newsletter and
    // /newsletter/[slug], so feed readers (Feedly, Inoreader, Reeder)
    // couldn't pick up the feed when a user pasted the homepage or any
    // other URL. Promoting the alternate to the root metadata propagates
    // it to every page's <head> — every URL on the site now hands the
    // feed reader a subscribe target without the user hunting for the
    // newsletter page first.
    types: {
      "application/rss+xml": "https://omnileadsagi.com/newsletter/rss.xml",
    },
  },
  openGraph: {
    title: "Omni AI — Autonomous Lead Generation & Agentic Infrastructure",
    description: "Autonomous AI systems that generate leads, run operations, and scale businesses 24/7. No micromanagement required.",
    url: "https://omnileadsagi.com",
    siteName: "Omni AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI — Autonomous Lead Generation & Agentic Infrastructure",
    description: "Autonomous AI systems that generate leads, run operations, and scale businesses 24/7.",
    // site + creator — verified @SitaniMafi X handle attribution on
    // every page's default Twitter card. Per-page routes that override
    // the whole twitter metadata block already inline `site:
    // "@SitaniMafi"` (app/[slug]/page.tsx, app/newsletter/[slug]/page.tsx,
    // app/vs/[competitor]/page.tsx); declaring the handle at the root
    // covers every page that DOESN'T override the block (/, /about,
    // /pricing, /faq, /interlinked, /campaigns, /arena, etc.) so every
    // share from the site ships a branded card. Without this, the
    // non-overriding pages rendered a card with no site attribution —
    // a real identity-graph gap because Twitter's ranking preferentially
    // boosts cards with verified `site` attribution.
    site: "@SitaniMafi",
    creator: "@SitaniMafi",
  },
  icons: {
    icon: "/favicon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

/**
 * Viewport export — NOT the `metadata` export.
 *
 * `themeColor` is a documented field of the `Metadata` type, so setting it
 * there type-checks, builds, and lints clean — and emits **nothing**. In
 * the App Router the `<meta name="theme-color">` tag is generated only from
 * the `viewport` export (`node_modules/next/dist/lib/metadata/generate/basic.js`
 * reads `viewport.themeColor`; the `metadata.themeColor` field is resolved
 * and then dropped). That was verified against the deployed site: the tag was
 * absent from the served `<head>` after a clean build and deploy.
 *
 * This paints the mobile browser chrome — the address bar / toolbar above the
 * page — in the site's own near-black instead of the browser's default
 * light. `color-scheme: dark` in the `<head>` below already tells the UA the
 * *page* is dark, but on a phone the toolbar colour is what the visitor sees
 * first, and a white bar over a near-black site reads as a broken page.
 *
 * `colorScheme` is deliberately NOT set here: the `<head>` below already
 * emits `<meta name="color-scheme" content="dark">`, and declaring it twice
 * would put two identical tags in every page's head. The hex is the same
 * literal as the inline critical background below, and for the same reason: a
 * `<meta>` tag cannot reference a CSS custom property, and the token it
 * mirrors lives in the stylesheet that may not have loaded yet.
 */
export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Critical background, inlined.
            The site's canvas is near-black (`--background: 0 0% 2%` in
            globals.css), but that rule only applies once the stylesheet has
            downloaded and parsed. Measured under a realistic mobile profile
            (1.6 Mbps / 150 ms RTT) the document streamed at ~0.8 s while
            the stylesheet did not land until ~2.5 s — so for ~1.7 s the
            user was looking at the browser's default WHITE canvas with the
            page's content painted on it, on a dark site.

            This style is inline, so it applies the moment the <head> is
            parsed — the first flush — with no stylesheet fetch. The hex is
            a deliberate literal: the token `--background` lives in the very
            stylesheet that has not loaded yet, so there is nothing to
            reference here. It is the value that variable resolves to
            (hsl(0 0% 2%) = rgb(5,5,5)). */}
        <style dangerouslySetInnerHTML={{ __html: "html{background-color:#050505}" }} />
        {/* Tell the UA the page is dark BEFORE any CSS arrives: this sets the
            canvas, scrollbars, form controls and overscroll area to the dark
            palette rather than the light one. It is the standard
            dark-mode-site recommendation and it is also what stops the
            scrollbar from flashing white on the long newsletter pages. */}
        <meta name="color-scheme" content="dark" />
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <JsonLd data={softwareSchema} />
        {/* Site-wide navigation manifest — tells Google + LLMs which
            pages are the canonical top-level surfaces. Keeps this list
            in sync with footer.tsx + navbar so the schema doesn't lie.
            See components/json-ld.tsx for why most sites skip this and
            why shipping it is a cheap retrieval-rank lift. */}
        <JsonLd data={siteNavigationSchema} />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <SpaceBackdrop />
        {/* SiteTracker fires page_view on every route change and click events
            via a delegated listener. Wrapped in Suspense because it reads
            useSearchParams, which Next 14 requires be inside a Suspense
            boundary. Fails silent — never blocks render. */}
        <Suspense fallback={null}>
          <SiteTracker />
        </Suspense>
        <ErrorTelemetry />
        <Providers>{children}</Providers>
        <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA4_ID} sendPageView />
      </body>
    </html>
  );
}
