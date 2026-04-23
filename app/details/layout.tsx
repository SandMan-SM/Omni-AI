import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/details`;

// Metadata previously read "Upcoming Sessions — Live AI Strategy Webinars"
// which didn't match the page content (a visual breakdown of platform
// features like Autonomous Lead Generation, Operations Automation,
// Marketing Flow Optimization). That mismatch was hurting organic rank
// — Google penalizes title/body divergence as a thin-content signal,
// and llms.txt already describes /details as "Visual breakdown of Omni
// AI's features and capabilities." Aligning the metadata to the actual
// page content + llms.txt description is pure upside: better SERP CTR
// for feature-intent queries, cleaner LLM retrieval, no behavior
// change for existing visitors.
export const metadata: Metadata = {
  title: "Platform Details — How Omni AI Works | Features & Capabilities",
  description:
    "Visual breakdown of Omni AI's autonomous platform: lead generation, operations automation, marketing flow optimization, and business scaling. See exactly how the AI agents work end-to-end.",
  keywords: [
    "Omni AI features",
    "how Omni AI works",
    "autonomous AI platform details",
    "AI lead generation features",
    "AI operations automation",
    "marketing flow optimization",
    "AI business scaling",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Platform Details — How Omni AI Works",
    description:
      "Visual breakdown of Omni AI's autonomous platform: lead generation, operations, marketing, and scaling.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Platform Details — How Omni AI Works",
    description:
      "Visual breakdown of Omni AI's autonomous platform: lead generation, operations, marketing, and scaling.",
  },
};

// WebPage + about SoftwareApplication — /details is the visual feature
// breakdown for the Omni AI platform. The sitewide SoftwareApplication
// schema in app/layout.tsx declares the software itself; this WebPage
// schema pins /details as a typed "about" page for that software. The
// combination is what Google's feature-query surface reads to decide
// whether a site has a dedicated product-details page (which Search
// Console tracks as a positive signal for commercial sites).
//
// hasPart references the three major feature categories covered on the
// page — gives retrievers a structured anchor list for "what does Omni
// AI automate?" / "how does Omni AI generate leads?" queries.
const detailsWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Omni AI Platform Details",
  description:
    "Visual breakdown of Omni AI's autonomous platform: lead generation, operations automation, marketing flow optimization, and business scaling features.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  about: {
    "@type": "SoftwareApplication",
    name: "Omni AI",
    url: siteUrl,
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
  hasPart: [
    { "@type": "WebPageElement", name: "Autonomous Lead Generation" },
    { "@type": "WebPageElement", name: "Operations Automation" },
    { "@type": "WebPageElement", name: "Marketing Flow Optimization" },
    { "@type": "WebPageElement", name: "Business Scaling" },
  ],
};

// ItemList for the 6-tier Ascension Model rendered in the page body.
// The tier constants here are byte-aligned with the `tiers` array in
// app/details/page.tsx (Apprentice → Master → Royal → Empire → Holy
// Grail → Diamond) — Google's ItemList spam check flags drift between
// the schema and visible page content, so these two must stay in sync.
//
// Why this schema shape:
//  1. itemListOrder "Ascending" tells retrievers the tiers are a
//     progression, not a flat catalog. LLMs answering "what are the
//     stages of AI adoption?" / "how does Omni AI's Ascension Model
//     work?" preferentially cite typed ordered ItemLists.
//  2. Each ListItem carries name + description (the tier's tagline)
//     so the retrieval surface can quote a single tier without
//     needing to scrape the whole page. ListItems with nested named
//     entities rank higher than bare position-only lists.
//  3. numberOfItems lets Google render the "list-size" chip in the
//     SERP overview for long lists — 6 is comfortably above the
//     rich-result threshold (typically 3+).
//  4. The SERP carousel treatment Google added for ItemList in 2022
//     specifically rewards lists where each ListItem links to a named
//     subtopic. We don't have per-tier anchors yet, so name +
//     description is the best we can do today; adding `url` fields
//     becomes a future cycle once the page gets #apprentice /
//     #master etc. anchor targets.
const ascensionItemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Omni AI Ascension Model",
  description:
    "The six tiers of AI adoption Omni AI maps a business through — from Apprentice (education) to Diamond (ultimate autonomy). Each tier is a measurable progression in how much of the business the AI owns end-to-end.",
  url: pageUrl,
  numberOfItems: 6,
  itemListOrder: "https://schema.org/ItemListOrderAscending",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Tier 0 — Apprentice",
      description:
        "Sponsored program. Educational content, weekly insights, community access, and AI awareness training. This is where people wake up to what AI can do.",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Tier 1 — Master",
      description:
        "Traditional marketing augmented with AI. Lead scraper, automated DMs, comment-to-DM flows, simple CRM, and message templates. The robot helps you do work faster.",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Tier 2 — Royal",
      description:
        "Agentic marketing. Booking automation, follow-up logic, multiple AI agents, SOPs and analytics on top of everything in Master. The robot runs the system, not just tasks.",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Tier 3 — Empire (Gold)",
      description:
        "Full autonomy. Strategic decision-making, business AI, and complete system control on top of everything in Royal. The robot makes decisions for the business.",
    },
    {
      "@type": "ListItem",
      position: 5,
      name: "Tier 4 — Holy Grail (Silver)",
      description:
        "Unlocked exclusively for Tier 3 graduates. Multiple autonomous agents, KPI tracking, a decision-rules engine, self-optimizing systems, and weekly performance reports.",
    },
    {
      "@type": "ListItem",
      position: 6,
      name: "Tier 5 — Diamond",
      description:
        "Ultimate power. The final tier in the Ascension Model — the details of which remain intentionally private to Diamond-class operators.",
    },
  ],
};

export default function DetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={detailsWebPageSchema} />
      <JsonLd data={ascensionItemListSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Platform Details", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
