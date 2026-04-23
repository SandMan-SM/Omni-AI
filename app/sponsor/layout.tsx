import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/sponsor`;

export const metadata: Metadata = {
  title: "Sponsor Omni AI — Partner with an AI-Powered Marketing Agency",
  description:
    "Become a sponsor of Omni AI. Partner with us to fund AI-managed marketing campaigns for local businesses and gain brand visibility across our ecosystem.",
  keywords: [
    "Omni AI sponsor",
    "AI marketing sponsor",
    "business sponsorship",
    "AI agency partner",
    "marketing partnership",
    "sponsor Interlinked newsletter",
    "newsletter sponsorship",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Sponsor Omni AI — Partner with an AI-Powered Marketing Agency",
    description:
      "Partner with Omni AI to fund AI-managed marketing for local businesses and gain brand visibility.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsor Omni AI — Partner with an AI-Powered Marketing Agency",
    description:
      "Partner with Omni AI to fund AI-managed marketing for local businesses and gain brand visibility.",
  },
};

// WebPage + ContactPage (union type via additionalType) — /sponsor is
// both a marketing page about partnership AND a contact surface for
// prospective sponsors to reach out. Dual-typing it gives Google +
// LLMs the widest retrieval surface: "sponsor Omni AI", "Omni AI
// partnership", "sponsor Interlinked newsletter", and "contact Omni
// AI for partnership" all resolve to this page with the correct intent.
//
// mainEntity explicitly declares the Organization being sponsored —
// Google's partnership / sponsorship retrieval patterns look for this
// field to disambiguate the sponsoree from the sponsor.
const sponsorWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  additionalType: "https://schema.org/ContactPage",
  name: "Sponsor Omni AI — Partnership & Sponsorship Opportunities",
  description:
    "Sponsor Omni AI to fund AI-managed marketing campaigns for local businesses and gain brand visibility across the Omni AI ecosystem (platform, Interlinked newsletter, AI Agent Arena, and daily trending content).",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  mainEntity: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
};

export default function SponsorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={sponsorWebPageSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Sponsor", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
