import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/fray`;

export const metadata: Metadata = {
  title: "VIP Sponsor — Fund 3 Businesses, One Monthly Investment | Omni AI",
  description:
    "Sponsor AI-managed marketing for Youngs, Leifson Built, and Omni Leads LLC. Websites, Facebook ads, lead capture, and newsletters — fully autonomous. $3,000/mo, 4-month commitment.",
  keywords: [
    "VIP sponsor Omni AI",
    "AI marketing sponsorship",
    "sponsor small businesses",
    "fund AI marketing",
    "autonomous marketing sponsorship",
    "Interlinked sponsor",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "VIP Sponsor — Fund 3 Businesses, One Monthly Investment",
    description:
      "AI-managed marketing for 3 businesses. Websites, Facebook ads, lead capture, and newsletters. $3,000/mo.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "VIP Sponsor — Fund 3 Businesses, One Monthly Investment",
    description:
      "AI-managed marketing for 3 businesses. Websites, Facebook ads, lead capture, and newsletters. $3,000/mo.",
  },
};

// Service + Offer schema — /fray is a specific commercial offering
// (fund 3 businesses at $3,000/month on a 4-month minimum commitment).
// Unlike /sponsor which is a general partnership landing page, /fray
// has a fixed price point and fixed deliverables, so modelling it as a
// typed Service with a priced Offer is correct and unlocks Google's
// Service rich result for "sponsor businesses AI marketing" queries.
//
// Offer.price is explicit here (unlike /book-now where the call is
// free and /pricing where paid tiers are custom). Publishing a concrete
// $3,000/month price qualifies the page for Google's price-chip SERP
// treatment, which is the single highest-CTR commercial result format.
//
// Offer.priceSpecification.referenceQuantity = 4 months signals the
// minimum commitment term to both Google and LLMs. Commitment-length
// data is a common retrieval signal for sponsorship-intent queries
// ("how long is the commitment?", "monthly vs annual sponsorship?").
const fraySponsorshipService = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI VIP Sponsorship",
  serviceType: "AI Marketing Sponsorship — Multi-Business Patronage",
  description:
    "Sponsor fully autonomous AI-managed marketing for three local businesses (Youngs, Leifson Built, Omni Leads LLC). Includes website management, Facebook ad campaigns, lead capture funnels, and newsletter delivery — all run autonomously by Omni AI agents. $3,000/month with a 4-month minimum commitment.",
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
  },
  areaServed: { "@type": "Place", name: "Worldwide" },
  audience: {
    "@type": "Audience",
    audienceType:
      "Impact-minded sponsors, philanthropic founders, and brand partners seeking visible co-marketing across the Omni AI ecosystem.",
  },
  category: "Sponsorship",
  url: pageUrl,
  offers: {
    "@type": "Offer",
    name: "VIP Sponsor — 3-Business Package",
    price: "3000",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    description:
      "$3,000/month. 4-month minimum commitment. Covers autonomous AI marketing for 3 sponsored businesses.",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "3000",
      priceCurrency: "USD",
      unitText: "MONTH",
      referenceQuantity: {
        "@type": "QuantitativeValue",
        value: "4",
        unitText: "MONTH",
      },
    },
  },
};

export default function FrayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={fraySponsorshipService} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "VIP Sponsor", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
