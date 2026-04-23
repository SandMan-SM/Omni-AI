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

export default function DetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={detailsWebPageSchema} />
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
