import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/affiliate/info`;

export const metadata: Metadata = {
  title: "Affiliate Program — Earn 30% Recurring | Omni AI",
  description:
    "Refer clients to Omni AI and earn 30% recurring on every subscription — no fees, no minimums. Live dashboard, tracked links, paid monthly as long as they stay.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Omni AI Affiliate Program — 30% Recurring Commissions",
    description:
      "Share a tracked link. Earn 30% of every subscription your referrals pay, every month they stay.",
    url: pageUrl,
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI Affiliate Program — 30% Recurring",
    description: "Apply in 60 seconds. Share your link. Earn 30% every month.",
  },
};

// Service + Offer schema for the affiliate program. /affiliate/info was
// shipping with bare metadata and zero structured data — which left it
// invisible to both Google's Service rich-result surface and the LLM
// retrievers that answer "does Omni AI have an affiliate program?" /
// "what commission does Omni AI pay?" queries.
//
// Why Service (not Product / Offer alone):
//  - Schema.org models commission-based referral programs as Services
//    where the "buyer" is the affiliate and the "price" is their payout,
//    not the thing being sold. Modelling as a Service keeps the provider
//    (Omni AI) and audience (potential affiliates) unambiguous.
//  - Service unlocks Google's Service rich result for "affiliate program"
//    head-intent queries, which is a low-competition commercial surface
//    most SaaS companies leave empty.
//
// Offer.description carries the commission rate in natural language
// because Offer.price expects a currency amount, not a percentage.
// Publishing "30" under `price` with a USD currency would imply a flat
// $30 payout and confuse Google's Rich Results validator. The literal
// commission terms live in the description + priceSpecification fields
// where they're unambiguous to both human readers and retrievers.
//
// `offers.eligibleDuration` declares the commission is recurring for the
// lifetime of the referred subscription. This is the single highest-
// leverage field for "is the Omni AI affiliate commission recurring or
// one-time?" — a question almost every potential affiliate asks before
// signing up, and one that commonly gets buried under marketing copy.
const affiliateServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI Affiliate Program",
  serviceType: "Affiliate / Partner Referral Program",
  description:
    "Refer clients to Omni AI and earn 30% recurring commission on every subscription they hold — paid monthly, with no cap, for the full lifetime of each referred account. Includes a live dashboard with clicks/conversions/revenue attribution, a unique tracked affiliate link, and no application fees, minimums, or gatekeeping. Built for creators, consultants, agencies, and operators with an audience of small and mid-market businesses.",
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
      "Creators, consultants, marketing agencies, and operators with access to small or mid-market business owners evaluating AI lead generation and business automation tools.",
  },
  category: "Affiliate Marketing",
  url: pageUrl,
  offers: {
    "@type": "Offer",
    name: "30% Recurring Affiliate Commission",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    priceCurrency: "USD",
    description:
      "30% of every referred subscription's monthly revenue, paid to the affiliate every month for as long as the referred account remains active. No fees, no minimums, no cap. Paid out monthly via standard payout rails.",
    // eligibleDuration declares the commission is paid for the full
    // subscription lifetime — the single most-asked question about any
    // affiliate program. Schema.org's QuantitativeValue with unitCode
    // ANN (years) and value 99 is the idiomatic way to represent
    // "indefinite / lifetime" without a literal LIFETIME enum.
    eligibleDuration: {
      "@type": "QuantitativeValue",
      value: 99,
      unitCode: "ANN",
      description: "Recurring — paid monthly for the full lifetime of each referred subscription.",
    },
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      priceCurrency: "USD",
      description:
        "30% recurring commission on monthly subscription revenue from referred customers. Percentage-based; exact monthly payout depends on the referred account's subscription tier.",
      valueAddedTaxIncluded: false,
    },
    seller: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
    },
  },
  // potentialAction — RegisterAction points at this page as the canonical
  // entry point for becoming an affiliate. Parallels the RegisterAction
  // on /join (free-tier signup) and tells LLMs this URL is the answer to
  // "how do I sign up to be an Omni AI affiliate?". The modal-based
  // signup UI on the page body accepts the application directly, so the
  // page URL is the correct action target (no separate endpoint URL).
  potentialAction: {
    "@type": "RegisterAction",
    name: "Apply to the Omni AI Affiliate Program",
    target: {
      "@type": "EntryPoint",
      urlTemplate: pageUrl,
      actionPlatform: [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform",
      ],
    },
  },
};

// WebPage schema paired with the Service above. speakable is only
// valid on WebPage / CreativeWork (not on Service, per schema.org
// inheritance). Splitting into two typed blocks keeps each schema
// clean and gives retrievers two independent surfaces:
//
//  - Service with Offer → Google Service rich result for "Omni AI
//    affiliate program" commercial queries
//  - WebPage with speakable + about: Service → voice assistants
//    read the hero aloud on "how do I become an Omni AI affiliate?"
//    / "does Omni AI have an affiliate program?" queries
//
// The about: { Service } edge lets retrievers walk from "tell me
// about the Omni AI affiliate program" → WebPage hero speakable
// reply → Service.description for the 30% commission + monthly
// payout detail.
const affiliateInfoWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Omni AI Affiliate Program — 30% Recurring Commission",
  description:
    "Overview of the Omni AI affiliate program: earn 30% recurring commission on every Omni AI client you refer, with live tracking and monthly payouts. Built for creators, consultants, and operators.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  about: {
    "@type": "Service",
    name: "Omni AI Affiliate Program",
    url: pageUrl,
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
  // SpeakableSpecification — when a user asks Google Assistant / Siri
  // read-aloud / Alexa "how do I become an Omni AI affiliate?" /
  // "does Omni AI have an affiliate program?" / "what's the Omni AI
  // referral commission?", voice assistants need declared selectors
  // to read verbatim. The h1 ("Get paid to put AI in the hands of
  // businesses that need it.") plus the subtitle tagged with
  // data-speakable="intro" in app/affiliate/info/page.tsx ("Earn
  // 30% recurring on every Omni AI client you refer. Track it live.
  // Get paid monthly. Built for creators, consultants, and
  // operators who already talk about this stuff.") compose the
  // natural ~12-second voice reply — tight enough for a briefing
  // slot, commercial enough to close the query's intent.
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "[data-speakable='intro']"],
  },
};

export default function AffiliateInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* WebPage schema with speakable — see the constant above for why
          speakable lives on WebPage rather than the Service below
          (schema.org inheritance: speakable is only valid on WebPage /
          CreativeWork). Matches the split-schema pattern on /arena,
          /sponsor/info, and /book-now. */}
      <JsonLd data={affiliateInfoWebPageSchema} />
      {/* Service + Offer schema — unlocks Google Service rich result and
          gives LLMs a typed entity to cite for "Omni AI affiliate
          program" / "affiliate commission" queries. See the constant
          above for why the commission lives in description + eligibleDuration
          rather than Offer.price. */}
      <JsonLd data={affiliateServiceSchema} />
      {/* Breadcrumb schema — pairs with the visible breadcrumb added to
          app/affiliate/info/page.tsx. /affiliate/info is the canonical
          program overview (there is no separate /affiliate hub page), so
          the correct shape is a two-level Home → Affiliate Program
          crumb. Padding a third level with a duplicate URL would trip
          Google's breadcrumb validator (repeated items flagged as
          low-quality). */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Affiliate Program", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
