// /solutions — à la carte services catalog. Every service carries its
// own PayPal payment option: one-time buttons for builds (websites, AI
// CEO, CRM) and monthly subscription buttons for managed services
// (newsletter, SEO/GEO, email & SMS, social, cybersecurity, lead-gen,
// chatbot+voice, analytics, hosting, Meta Ads). Same cinematic visual
// system as /meta. Service facts live in lib/solutions.ts.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SolutionsClient } from "./SolutionsClient";
import { WEBSITE_TIERS, SOLUTIONS } from "@/lib/solutions";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/solutions`;

// PayPal public Client ID (publishable — browser-safe, like a Stripe
// publishable key). Baked in so the live deploy works without a Vercel
// env var. Same app used across /meta and the membership plans.
const PAYPAL_CLIENT_ID =
  "AW72P6A-yKEg77Tkh866rDoce2DKYU2EUhGKQp-401eIFKpSERKCOETvqtcSYTVTN4rnFbvBt6vP6Lf4";

export const metadata: Metadata = {
  title: "Solutions · À La Carte AI Services | Omni AI",
  description:
    "Buy any AI Integrated Solutions service à la carte: agentic websites ($25k+), AI CEO with advanced marketing ($100k+), hyper-advanced newsletters, SEO & GEO, email & SMS, custom CRM, social automation, cybersecurity, and more — each with its own PayPal payment option.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "AI Integrated Solutions · À La Carte AI Services",
    description:
      "Agentic websites, AI CEO, agentic newsletters, SEO & GEO, email & SMS, custom CRM, social automation, cybersecurity — buy any service à la carte with PayPal from AI Integrated Solutions.",
    url: PAGE_URL,
    siteName: "AI Integrated Solutions",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/api/og?title=AI%20Integrated%20Solutions&topic=%C3%80%20La%20Carte%20AI%20Services`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Integrated Solutions · À La Carte AI Services",
    description:
      "Buy any service à la carte with PayPal from AI Integrated Solutions — websites, AI CEO, newsletters, SEO/GEO, email & SMS, CRM, social, cybersecurity.",
  },
  robots: { index: true, follow: true },
};

// JSON-LD — OfferCatalog of every service, + breadcrumb. Built from the
// same lib/solutions.ts data so structured data and the page never drift.
function solutionsJsonLd() {
  const all = [...WEBSITE_TIERS, ...SOLUTIONS];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Omni AI — À La Carte AI Services",
        provider: { "@type": "Organization", name: "Omni AI", url: SITE_URL },
        url: PAGE_URL,
        description:
          "Buy any Omni AI service à la carte: agentic websites, AI CEO, agentic newsletters, SEO & GEO, email & SMS, custom CRM, social automation, and cybersecurity.",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Omni AI Solutions",
          itemListElement: all.map((s) => ({
            "@type": "Offer",
            name: s.name,
            description: s.blurb,
            ...(s.amount
              ? { price: s.amount, priceCurrency: "USD" }
              : { priceSpecification: { "@type": "PriceSpecification", description: s.price } }),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Solutions", item: PAGE_URL },
        ],
      },
    ],
  };
}

export default function SolutionsPage(): ReactNode {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(solutionsJsonLd()) }}
      />
      <SolutionsClient
        pageUrl={PAGE_URL}
        paypalClientId={PAYPAL_CLIENT_ID}
        websiteTiers={WEBSITE_TIERS}
        solutions={SOLUTIONS}
      />
    </>
  );
}
