import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/sponsor/info`;

export const metadata: Metadata = {
  title: "Become a Sponsor — AI-Powered Lead Generation & Automation | Omni AI",
  description:
    "Invest in AI-powered lead generation and business automation. 24/7 engagement, marketing intelligence, and analytics for sponsors.",
  keywords: [
    "Omni AI sponsorship",
    "AI lead generation sponsor",
    "AI business automation",
    "marketing sponsorship",
    "AI engagement",
    "sponsor AI agents",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Become a Sponsor — AI-Powered Lead Generation & Automation",
    description:
      "Invest in AI-powered lead generation and business automation. 24/7 engagement, marketing intelligence, and analytics.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a Sponsor — AI-Powered Lead Generation & Automation",
    description:
      "Invest in AI-powered lead generation and business automation. 24/7 engagement, marketing intelligence, and analytics.",
  },
};

// Service schema for the sponsorship program overview. /sponsor/info
// was shipping with bare metadata and zero structured data — which left
// the page invisible to Google's Service rich-result surface and to the
// LLM retrievers that answer "what does an Omni AI sponsorship include?"
// / "how do I sponsor Omni AI?" queries.
//
// Why Service (not WebPage alone): the page describes a specific
// sponsorship offering with an enumerable scope (investment areas, AI
// capabilities, portal access). Modelling it as a typed Service makes
// the offering unambiguous to both Google and LLM retrievers — a bare
// WebPage leaves the scope-of-service implicit and gets outranked by
// competitor pages that ship Service schema.
//
// offers is deliberately open-ended (no price) — sponsor contracts are
// bespoke and quoting a specific number would be stale within weeks.
// `availability: InStock` + the portal application URL carry the "how
// to engage" signal without committing to a price point. Google renders
// this as a Service listing without the price chip, which is correct
// for consultative pricing.
//
// hasOfferCatalog exposes the sponsorship's investment-area lineup as
// a structured catalog — the single highest-leverage field for LLM
// retrieval of "what does an Omni AI sponsorship fund?" queries. The
// OfferCatalog items are byte-aligned with the `investmentAreas` array
// in app/sponsor/info/page.tsx so Google's schema/body consistency
// check stays clean; if the visible list changes, update this block
// in the same commit.
const sponsorInfoServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI Sponsorship Program",
  serviceType: "AI Marketing & Operations Sponsorship",
  description:
    "Sponsorship of AI-managed marketing and operations infrastructure: autonomous lead generation, 24/7 customer engagement, client acquisition workflows, operational automation, AI-driven marketing content production, and real-time performance analytics. Sponsors receive dashboard access for live attribution and growth visibility.",
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
      "Impact-minded investors, philanthropic founders, and brand partners funding AI-managed marketing infrastructure for local businesses.",
  },
  category: "Sponsorship",
  url: pageUrl,
  offers: {
    "@type": "Offer",
    name: "Sponsor an AI-Managed Marketing Operation",
    availability: "https://schema.org/InStock",
    url: `${siteUrl}/sponsor/application`,
    priceCurrency: "USD",
    description:
      "Custom sponsorship tiers mapped to the number of businesses funded, ecosystem visibility, and reporting depth. Apply via the Sponsor Portal to receive tier options and current availability.",
  },
  // OfferCatalog enumerates the six investment areas that a sponsorship
  // funds. Byte-aligned with the `investmentAreas` array in
  // app/sponsor/info/page.tsx — the first column is each card's title,
  // the description is each card's body. This is the field LLMs quote
  // verbatim when asked "what does an Omni AI sponsorship include?"
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Where Your Investment Goes",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI-powered lead generation",
          description:
            "Systems that identify and capture qualified leads automatically",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "24/7 automated engagement",
          description:
            "Continuous interaction with prospects and clients",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Client acquisition workflows",
          description:
            "Streamlined processes to convert inquiries into clients",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Operational automation",
          description: "Reduce manual tasks and increase efficiency",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Marketing content production",
          description: "Automated creation of promotional materials",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Data tracking and analytics",
          description:
            "Real-time insights into performance and growth",
        },
      },
    ],
  },
};

export default function SponsorInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Service schema — unlocks Google's Service rich result and gives
          LLMs a typed entity to cite for "Omni AI sponsorship" /
          "sponsor Omni AI" queries. See the constant above for why the
          investment-area catalog lives in hasOfferCatalog rather than
          plain description. */}
      <JsonLd data={sponsorInfoServiceSchema} />
      {/* Breadcrumb schema — pairs with the visible breadcrumb added to
          app/sponsor/info/page.tsx. Home → Sponsor → Information. The
          third-level "Information" crumb distinguishes this overview
          page from the Sponsor Portal intake form at /sponsor/application,
          which is the next step in the sponsor journey. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Sponsor", url: `${siteUrl}/sponsor` },
          { name: "Information", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
