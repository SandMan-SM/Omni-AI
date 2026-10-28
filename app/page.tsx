import type { Metadata } from "next";
import NewsletterIndexPage from "./newsletter/page";

// Route configuration is not inherited from the imported newsletter page.
// The home shelf must refresh when the daily issue is published.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Interlinked by Omni AI — Free Premium AI Intelligence",
  description:
    "Interlinked tracks the AI stories, strategies, and operator signals that matter before the market catches up. Free premium membership for a limited time.",
  keywords:
    "Interlinked, AI newsletter, AI intelligence, business automation, AI strategy, premium AI membership",
  alternates: {
    canonical: "https://omnileadsagi.com/",
    types: {
      "application/rss+xml": "https://omnileadsagi.com/newsletter/rss.xml",
    },
  },
  openGraph: {
    title: "Interlinked by Omni AI — Free Premium AI Intelligence",
    description:
      "AI stories, strategies, and operator signals delivered for builders and operators.",
    url: "https://omnileadsagi.com/",
    siteName: "Omni AI",
  },
  twitter: {
    site: "@SitaniMafi",
    creator: "@SitaniMafi",
    card: "summary_large_image",
    title: "Interlinked by Omni AI — Free Premium AI Intelligence",
    description:
      "AI stories, strategies, and operator signals delivered for builders and operators.",
  },
};

export default NewsletterIndexPage;
