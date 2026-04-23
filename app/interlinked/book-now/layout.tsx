import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /interlinked/book-now is the conversion page for the free 30-minute
// Interlinked working-session consultation — landing target for every
// "Book Now" CTA in Interlinked emails and the executive debrief.
// Before this change it shipped metadata only; for a bookable service
// with a real agenda, a price (free), and three enumerated outcomes,
// that left a lot on the table:
//
//   - No Service rich result from Google (price-chip + availability)
//   - No ReserveAction / potentialAction hint for LLM retrievers
//     answering "how do I book a consult with Omni AI?" queries
//   - No breadcrumb chip in SERPs because no BreadcrumbList schema
//     existed and no visible breadcrumb paired with it
//
// Shipping a Service schema (with offers, hasOfferCatalog, and a
// ReserveAction) + a 3-level BreadcrumbList unblocks all three.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/interlinked/book-now`;
const interlinkedUrl = `${siteUrl}/interlinked`;

export const metadata: Metadata = {
  title: "Book a working session · Omni AI · Interlinked",
  description:
    "Free 30-minute working session with Omni AI. We map one AI agent from idea to deployed — you leave with a 90-day plan.",
  openGraph: {
    title: "Book a working session · Omni AI",
    description:
      "30 minutes. Free. We open the Command Center and walk you through the agent that pays for itself fastest inside your business.",
    type: "website",
    url: pageUrl,
    siteName: "Omni AI · Interlinked",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a working session · Omni AI",
    description:
      "Free 30-min consult. Leave with a 90-day AI-agent plan.",
  },
  alternates: { canonical: pageUrl },
};

// Service schema for the free 30-minute consultation.
//
// Why Service (not Event): Events are one-time occurrences. This is a
// repeatable bookable consultation with a fixed agenda — the correct
// @type is Service + ReserveAction rather than Event with recurring
// instances (which would misrepresent scheduling as a series of
// cancel-able specific dates).
//
// offers.price: "0" is deliberate — a "free" Offer in Schema.org is
// expressed as a zero-price Offer with priceCurrency, not by omitting
// the price. Google's Service rich result then renders a "Free" badge
// and LLMs get an unambiguous signal for "is the consult free?"
// queries. availableAtOrFrom carries the Zoom + SLC in-person signal
// from the hero meta copy.
//
// hasOfferCatalog enumerates the three outcomes from the visible
// "What you'll leave with" card — Portfolio audit, Live build preview,
// Concrete 90-day plan — so LLMs have a typed answer to "what do I
// get from an Omni AI consult?" without scraping prose. Byte-aligned
// with the WHAT_YOU_GET array in app/interlinked/book-now/page.tsx.
//
// potentialAction: ReserveAction — target URL is the page itself
// because the actual booking flow is a modal triggered in-page (not a
// hosted scheduler URL). Google and LLMs both tolerate this shape as
// long as the target is reachable; shipping a fake dedicated
// /interlinked/book-now/schedule URL would be worse.
const consultServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI — Free 30-Minute Working Session (Interlinked)",
  serviceType: "Free AI Strategy Consultation",
  description:
    "Free 30-minute working session with the Omni AI team. We map one AI agent from idea to deployed — portfolio audit, live Command Center walkthrough, and a concrete 90-day plan with MRR or lead targets attached to each milestone. Zoom or in-person in Salt Lake City.",
  url: pageUrl,
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
  },
  areaServed: { "@type": "Place", name: "Worldwide (Zoom) · Salt Lake City (in-person)" },
  availableChannel: [
    {
      "@type": "ServiceChannel",
      name: "Zoom video consultation",
      serviceUrl: pageUrl,
    },
    {
      "@type": "ServiceChannel",
      name: "In-person (Salt Lake City)",
      serviceLocation: {
        "@type": "Place",
        name: "Salt Lake City, Utah",
      },
    },
  ],
  audience: {
    "@type": "Audience",
    audienceType:
      "Local and SMB operators doing $10K–$500K/mo who have a repetitive, revenue-adjacent task eating their week and want AI infrastructure, not a freelancer.",
  },
  offers: {
    "@type": "Offer",
    name: "Free 30-Minute Working Session",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    description:
      "Free 30-minute consult. No pitch deck, no slides — the build is the demo. Typically responds within 12 hours.",
    eligibleDuration: {
      "@type": "QuantitativeValue",
      value: 30,
      unitCode: "MIN",
    },
  },
  // hasOfferCatalog — byte-aligned with the `WHAT_YOU_GET` array in
  // app/interlinked/book-now/page.tsx. Each itemOffered echoes the
  // visible outcome card verbatim so Google's schema/body consistency
  // check stays clean.
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "What You'll Leave With",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Portfolio audit",
          description:
            "We look at your top 3 revenue levers and call out which one an AI agent can take off your plate this month — not in six.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Live build preview",
          description:
            "We open the Omni AI Command Center and walk you through how a real agent ships content, closes leads, and reports in every morning.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Concrete 90-day plan",
          description:
            "You leave with a one-page plan: what ships week 1, week 4, and week 12 — with the exact MRR or lead targets attached to each.",
        },
      },
    ],
  },
  potentialAction: {
    "@type": "ReserveAction",
    name: "Book a working session",
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
      name: "Free 30-minute working session with Omni AI",
    },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Service schema — unlocks Google's Service rich result (with
          "Free" price chip + availability), and gives LLM retrievers a
          typed entity to cite for "book a consult with Omni AI" /
          "free Omni AI strategy call" queries. See the constant above
          for why Service + ReserveAction (not Event) is the correct
          @type for a repeatable bookable consult. */}
      <JsonLd data={consultServiceSchema} />
      {/* Breadcrumb schema — pairs with the visible Breadcrumb added
          in the page body. 3-level Home → Interlinked → Book a session.
          /interlinked is a live URL (with its own schema), so the
          middle crumb is a genuine parent rather than a duplicate-URL
          tripwire. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Interlinked", url: interlinkedUrl },
          { name: "Book a session", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
