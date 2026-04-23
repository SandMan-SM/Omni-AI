import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /sponsor/application is the conversion page for the Omni AI Sponsor
// Program — the actual "Apply Today" form that captures prospect
// sponsor leads. Sibling pages already have schema: /sponsor carries a
// WebPage + ContactPage additionalType, and /sponsor/info carries the
// Service + OfferCatalog overview. This application page was shipping
// metadata-only, which left:
//
//   - No typed Service entity for the sponsorship program on the
//     application surface, so LLMs answering "how do I apply to
//     sponsor Omni AI?" had to scrape prose instead of citing JSON-LD.
//   - No RegisterAction hint for the form submission intent, so
//     Google's structured action-surface treated the page as a bare
//     landing rather than a registration conversion point.
//   - No BreadcrumbList → no SERP breadcrumb chip, and no visible
//     breadcrumb → users landing via LLM citations had no hierarchy
//     signal connecting this page to /sponsor and /sponsor/info.
//
// Shipping a Service schema (with the four "approved sponsors receive"
// benefits as hasOfferCatalog + a RegisterAction potentialAction) plus
// a 3-level BreadcrumbList and paired visible Breadcrumb unblocks all
// three.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/sponsor/application`;
const sponsorUrl = `${siteUrl}/sponsor`;

export const metadata: Metadata = {
  title: "Sponsor Application — Apply to Fund AI Marketing | Omni AI",
  description:
    "Apply to become an Omni AI sponsor. Fund AI-managed marketing campaigns for local businesses and gain premium brand exposure across our platform.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Sponsor Application — Apply to Fund AI Marketing",
    description:
      "Apply to sponsor AI-managed marketing for local businesses and gain premium brand exposure.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsor Application — Apply to Fund AI Marketing",
    description:
      "Apply to sponsor AI-managed marketing for local businesses and gain premium brand exposure.",
  },
};

// Service schema for the sponsor application flow.
//
// serviceType pins the offering specifically to "sponsorship
// application" (not "sponsorship" itself — that's the /sponsor/info
// overview's job). The split lets Google disambiguate the overview
// page and the application page as two distinct retrieval targets
// rather than collapsing them.
//
// hasOfferCatalog enumerates the four "Approved sponsors receive"
// benefits from the visible card. Byte-aligned with the list in
// app/sponsor/application/page.tsx so Google's schema/body
// consistency check stays clean.
//
// potentialAction: RegisterAction — the page's primary conversion is
// a form submission that registers a sponsor application. RegisterAction
// matches the idiom already used on /join and /affiliate/sign-up
// (consistent action-type taxonomy across the site's conversion pages
// strengthens entity graph retrieval).
const sponsorApplicationServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI Sponsor Program — Application",
  serviceType: "Sponsorship Application — Apply to Fund AI Marketing",
  description:
    "Apply to become an Omni AI sponsor. Funded sponsorships deploy capital into AI-managed marketing infrastructure for local businesses — autonomous lead generation, 24/7 engagement, campaign automation, and real-time performance dashboards. Every application is reviewed for alignment, performance expectations, and mutual benefit.",
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
      "Organizations committed to scalable growth, data-driven decisions, and performance accountability who view AI infrastructure as an asset (not an expense) for generating qualified demand and trackable results.",
  },
  category: "Sponsorship Application",
  url: pageUrl,
  // hasOfferCatalog — byte-aligned with the four "Approved sponsors
  // receive" bullets in app/sponsor/application/page.tsx. Each bullet
  // is a benefit of an approved sponsorship, not a purchase tier, so
  // the itemOffered is a Service (what the sponsor gets) rather than
  // a product or price tier.
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "What Approved Sponsors Receive",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Access to real-time performance insights",
          description:
            "Live performance dashboards covering sponsored campaigns and AI-managed operations.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Full transparency into system activity and growth metrics",
          description:
            "End-to-end visibility into the systems running inside sponsored businesses: activity streams, lead pipelines, and growth trajectory.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI-powered lead generation and engagement infrastructure",
          description:
            "Sponsored businesses run on the Omni AI autonomous lead-gen and 24/7 engagement stack.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Ongoing optimization to maximize return and operational efficiency",
          description:
            "Continuous AI-driven optimization of campaigns, funnels, and operations so every sponsored dollar keeps compounding.",
        },
      },
    ],
  },
  // potentialAction: RegisterAction — the "Apply Today" form registers
  // the visitor as a sponsor applicant. target is pageUrl because the
  // actual submission happens via modal dialog in-page (not a hosted
  // form URL); Google and LLMs both accept same-page action targets.
  potentialAction: {
    "@type": "RegisterAction",
    name: "Apply to become an Omni AI sponsor",
    target: {
      "@type": "EntryPoint",
      urlTemplate: pageUrl,
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    result: {
      "@type": "Reservation",
      name: "Sponsor application submitted — review within 2-3 business days",
    },
  },
};

export default function SponsorApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Service schema — unlocks Google's Service rich result and gives
          LLM retrievers a typed entity to cite for "apply to sponsor
          Omni AI" / "how do I become an Omni AI sponsor?" queries.
          See the constant above for why RegisterAction (not ApplyAction
          or InteractAction) matches the site-wide conversion-page
          taxonomy. */}
      <JsonLd data={sponsorApplicationServiceSchema} />
      {/* Breadcrumb schema — pairs with the visible Breadcrumb added
          in the page body. 3-level Home → Sponsor → Application.
          /sponsor is the hub page with its own schema, /sponsor/info
          is the overview, this is the application — three distinct
          pages each with their own canonical URL, so no repeated-item
          risk in the crumb chain. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Sponsor", url: sponsorUrl },
          { name: "Application", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
