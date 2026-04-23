import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
