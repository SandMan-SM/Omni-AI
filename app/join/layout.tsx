import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/join`;

export const metadata: Metadata = {
  title: "Join Omni AI — Start Automating Your Business for Free",
  description:
    "Get started with Omni AI for free. Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
  keywords: [
    "join Omni AI",
    "AI automation signup",
    "free AI agents",
    "AI lead generation",
    "business automation",
    "get started AI",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Join Omni AI — Start Automating Your Business for Free",
    description:
      "Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Join Omni AI — Start Automating Your Business for Free",
    description:
      "Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
  },
};

// WebPage schema with nested RegisterAction — /join is the free-tier
// signup surface and the canonical answer to "how do I sign up for Omni
// AI?" / "is there a free Omni AI account?" queries.
//
// Why WebPage + potentialAction.RegisterAction instead of just Service:
//  - /campaigns and /book-now already declare typed Service entities
//    for distinct offerings. /join isn't a separate offering — it's the
//    entry point to the whole platform. Modelling it as a WebPage with
//    a registration action (RegisterAction) is the schema.org-correct
//    pattern and what Google's documentation recommends for signup
//    surfaces.
//  - RegisterAction inside potentialAction tells LLMs the page is the
//    canonical "start here" URL — they cite typed action targets more
//    reliably than they cite pages declared only via softwareSchema's
//    downloadUrl/installUrl (which are too weak a signal on their own).
//  - The sibling Service schema below is narrowly the *free-tier
//    access offering* — distinct from the sitewide SoftwareApplication
//    entity (which describes the platform overall). Decoupling them
//    lets Google award the Free chip on commercial "is Omni AI free"
//    queries without collapsing /join into the homepage.
//
// description field is intentionally verbose + keyword-rich — it's the
// single most-cited field when Perplexity / ChatGPT answer "what does
// the Omni AI free tier include?" and the query resolves to this page.
const joinWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Join Omni AI — Free Tier Signup",
  description:
    "Create a free Omni AI account. No credit card required. The free tier includes autonomous campaign generation, the AI Agent Arena for benchmarking AI performance, daily trending topic pages, and community support. Paid tiers unlock autonomous outbound, priority model access, and custom integrations.",
  url: pageUrl,
  isPartOf: {
    "@type": "WebSite",
    name: "Omni AI",
    url: siteUrl,
  },
  about: {
    "@type": "SoftwareApplication",
    name: "Omni AI",
    url: siteUrl,
  },
  potentialAction: {
    "@type": "RegisterAction",
    name: "Create free Omni AI account",
    target: {
      "@type": "EntryPoint",
      urlTemplate: pageUrl,
      actionPlatform: [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform",
      ],
    },
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
};

// Service schema — narrowly types the *free-tier access offering* so
// LLMs asked "is Omni AI free?" / "what's the Omni AI free tier?" /
// "how much does Omni AI cost?" retrieve a typed Free offer rather than
// scraping prose. Offer.price = "0" (the Schema.org idiom for free;
// omitting price drops the Free chip from the Service rich result).
// hasOfferCatalog enumerates the free-tier inclusions byte-aligned with
// /pricing's PRICING_FAQS answer — single source of truth prevents
// drift when tier contents change. eligibleDuration uses the 99 ANN
// "lifetime" idiom since the free tier has no expiration.
const joinFreeTierServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI — Free Tier Access",
  serviceType: "Free-Tier AI Platform Access",
  description:
    "Permanent free access to Omni AI — not a trial. Includes autonomous campaign generation, the AI Agent Arena for benchmarking AI performance, daily trending topic pages, and community support. No credit card required. Most operators validate Omni AI on the free tier before upgrading.",
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
      "Solo founders, marketing agencies, lean RevOps teams, and operators evaluating autonomous AI lead generation before committing to a paid tier.",
  },
  offers: {
    "@type": "Offer",
    name: "Free Tier — Omni AI Platform",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    description:
      "Permanent free access. Autonomous campaign generation + AI Agent Arena + daily trending content + community support. No credit card, no trial expiry.",
    eligibleDuration: {
      "@type": "QuantitativeValue",
      value: 99,
      unitCode: "ANN",
    },
  },
  // hasOfferCatalog enumerates the free-tier inclusions — byte-aligned
  // with the free-tier bullet list on /pricing/page.tsx. If the free-
  // tier contents change (either add or remove), update this list AND
  // the /pricing page list AND the PRICING_FAQS answer AND /faq's
  // "Is there a free tier?" answer in the same commit — all four are
  // the source of truth for a single user-facing fact.
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Omni AI Free Tier — Included Features",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Autonomous campaign generation",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI Agent Arena for benchmarking AI performance",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Daily trending topic landing pages",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Interlinked free newsletter tier",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Community support",
        },
      },
    ],
  },
  potentialAction: {
    "@type": "RegisterAction",
    name: "Create free Omni AI account",
    target: {
      "@type": "EntryPoint",
      urlTemplate: pageUrl,
      actionPlatform: [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform",
      ],
    },
    result: {
      "@type": "Registration",
      name: "Omni AI free-tier account with campaign generation + Arena access",
    },
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={joinWebPageSchema} />
      <JsonLd data={joinFreeTierServiceSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Join", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
