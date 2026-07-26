import type { Metadata } from "next";
import NewsletterIndexPage from "./newsletter/page";

export const metadata: Metadata = {
  title: "Interlinked — Free Premium AI Intelligence",
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
    title: "Interlinked — Free Premium AI Intelligence",
    description:
      "AI stories, strategies, and operator signals delivered for builders and operators.",
    url: "https://omnileadsagi.com/",
    siteName: "Interlinked",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked — Free Premium AI Intelligence",
    description:
      "AI stories, strategies, and operator signals delivered for builders and operators.",
  },
};

export default NewsletterIndexPage;
