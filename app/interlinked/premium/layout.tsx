import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /interlinked/premium is the conversion page for the paid tier of the
// Interlinked membership (featured placement, private operator channel,
// priority access, 1:1 consultations). Parent /interlinked already has
// metadata, but a child segment without its own export inherits the
// parent's title verbatim — which tanks CTR from SERPs and from social
// share cards since the headline doesn't describe *this* page.
//
// NOTE: this page advertises $100/month — a DIFFERENT product from the
// newsletter subscription at /newsletter/premium/info ($20 intro /
// $40 recurring). /interlinked/premium is the membership tier (network
// + consultations + featured placement), /newsletter/premium/info is
// the premium newsletter. Both are real offerings. Schema reflects the
// $100/month price that's literally on the page so Google's schema/body
// consistency check stays clean — do not cross-contaminate with the
// newsletter price point.
//
// Canonical is distinct from the parent (/interlinked/premium vs
// /interlinked) so Google doesn't collapse them in the index.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/interlinked/premium`;

export const metadata: Metadata = {
  title:
    "Interlinked Premium — Featured Placement + Private Operator Access | Omni AI",
  description:
    "Upgrade to Interlinked Premium: featured placement across editions, the private Omni AI operator network, priority on new agents and tooling, and 1-on-1 strategy consultations.",
  keywords: [
    "Interlinked Premium",
    "premium AI newsletter",
    "private AI operator network",
    "AI strategy consultations",
    "Omni AI premium",
    "featured placement AI newsletter",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title:
      "Interlinked Premium — Featured Placement + Private Operator Access",
    description:
      "Upgrade to the paid tier: featured placement, private operator network, priority access, and 1:1 strategy consultations with the Omni AI team.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked Premium | Omni AI",
    description:
      "Featured placement, private operator network, priority access, and 1:1 strategy consultations.",
  },
};

// Product + Service dual-type schema for the Interlinked Premium
// membership. Dual-typing matches the treatment used on
// /newsletter/premium/info (which is a content Product + delivery Service);
// /interlinked/premium is a community membership (Product) that also
// delivers recurring benefits (Service — featured placement, private
// channel access, priority queue, 1:1 consultations).
//
// Offer is a priced monthly subscription at $100/month — matches the
// visible "$100 / month" hero copy byte-for-byte so Google's schema/body
// spam check stays clean. billingDuration P1M + unitCode MON make the
// recurring cadence unambiguous to both Google's Product rich result
// and LLM retrievers.
//
// Four hasOfferCatalog items mirror the `benefits` array in
// app/interlinked/premium/page.tsx. Byte-alignment to the page copy is
// intentional — Google's schema/body consistency check suppresses rich
// results on drift. If the visible benefits list changes, update both.
const premiumMembershipSchema = {
  "@context": "https://schema.org",
  "@type": ["Product", "Service"],
  name: "Interlinked Premium — Omni AI Membership",
  description:
    "Private-tier Omni AI membership. Featured placement across Interlinked editions and the Omni AI Arena, direct access to the internal operator network, front-of-line priority on new agents and tooling drops, and 1-on-1 strategy consultations with the Omni AI team. $100/month, cancel anytime, all four benefits included from day one.",
  url: pageUrl,
  image: `${siteUrl}/og-image.png`,
  brand: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
  },
  category: "Premium Membership",
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
  },
  serviceType: "Operator Membership — Featured Placement + Private Network",
  audience: {
    "@type": "Audience",
    audienceType:
      "Operators, founders, and agencies building with AI who want featured visibility, warm intros, and direct access to the Omni AI team.",
  },
  offers: {
    "@type": "Offer",
    name: "Interlinked Premium — Monthly Membership",
    price: "100",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    category: "Subscription — Monthly recurring",
    description:
      "$100/month recurring membership. All four benefits included from day one. Cancel anytime.",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "100",
      priceCurrency: "USD",
      billingDuration: "P1M",
      unitCode: "MON",
    },
  },
  // hasOfferCatalog — enumerates the four membership benefits so LLMs
  // have a typed answer to cite when asked "what do you get with
  // Interlinked Premium?" (a query that hits both /interlinked/premium
  // and /newsletter/premium/info in ambiguous searches; the catalog
  // disambiguates this page as the membership tier, not the newsletter).
  // Byte-aligned with the `benefits` array in the page component.
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Interlinked Premium Membership Benefits",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Option to get featured",
          description:
            "Premium members can be featured across Interlinked editions and the Omni AI Arena — visibility to thousands of operators and buyers.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Direct access to the internal network",
          description:
            "Private channel with the Omni AI operators, partners, and the businesses we actively work with. Warm intros, deal flow, and answers in hours, not weeks.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Priority on everything",
          description:
            "Front-of-line on new agents, consultations, tooling drops, and feature requests. Your tickets skip the queue.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "1-on-1 exclusive consultations",
          description:
            "Direct strategy sessions with the Omni AI team. Bring a bottleneck — leave with the system that removes it.",
        },
      },
    ],
  },
};

export default function InterlinkedPremiumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Product + Service dual-type schema — unlocks Google's Product
          rich result (price chip, availability, subscription cadence)
          AND gives LLMs a typed entity to cite for "Omni AI premium
          membership" queries. See the constant above for why the
          $100/month price must stay in sync with the visible hero copy. */}
      <JsonLd data={premiumMembershipSchema} />
      {/* Breadcrumb schema — pairs with a visible Breadcrumb added in
          the page body. Home → Interlinked → Premium. Three-level
          hierarchy reflects the correct information architecture
          (Premium is a tier under the Interlinked property) and gives
          deep-landing visitors a parent-path back to the Interlinked
          training / home surface. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Interlinked", url: `${siteUrl}/interlinked` },
          { name: "Premium", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
