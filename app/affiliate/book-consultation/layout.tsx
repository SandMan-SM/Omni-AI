import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /affiliate/book-consultation is the modal-launch landing page for the
// AffiliateConsultationModal — a 30-minute working session for Omni AI
// affiliates to map their audience, angle, and the right products to
// recommend. The page itself is small (hero H1 + sub-copy + auto-open
// modal) so the schema is what carries the retrieval signal:
//
//   - Service entity — answers "what is an Omni AI affiliate
//     consultation?" / "book affiliate consultation" queries with a
//     typed object instead of scraped prose.
//   - ReserveAction — encodes the conversion intent for Google and
//     LLM retrievers.
//   - 3-level BreadcrumbList — Home → Affiliate Program → Book
//     Consultation. /affiliate/info is the live hub URL.
//
// Mirrors the schema shape used on /interlinked/book-now (also a
// free 30-min consult landing page). Consistent action taxonomy
// across bookable consult pages strengthens the entity graph.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/affiliate/book-consultation`;
const affiliateInfoUrl = `${siteUrl}/affiliate/info`;

export const metadata: Metadata = {
  title: "Book an Affiliate Consultation | Omni AI",
  description:
    "A free 30-minute working session for Omni AI affiliates. We map your audience, your angle, and the right Omni AI products to recommend — then hand you a written game plan.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "Book an Affiliate Consultation | Omni AI",
    description:
      "Free 30-minute session to plan your Omni AI affiliate strategy. Written game plan included.",
    url: pageUrl,
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book an Affiliate Consultation | Omni AI",
    description: "Free 30-min session. Written game plan. No obligation.",
  },
};

// Service schema for the free 30-minute affiliate consultation.
// Free price expressed as offers.price: "0" (the Schema.org idiom for
// "free" — omitting price would leave Google guessing and drop the
// Free chip from the Service rich result).
const affiliateConsultServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI — Free Affiliate Strategy Consultation",
  serviceType: "Free Affiliate Strategy Consultation",
  description:
    "A free 30-minute working session for Omni AI affiliates. We map your audience, your angle, and the right Omni AI products to recommend — then hand you a written game plan for your first 30 days as an affiliate.",
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
      "Creators, consultants, and operators who have signed up (or are considering signing up) as Omni AI affiliates and want a personalized strategy for their audience.",
  },
  offers: {
    "@type": "Offer",
    name: "Free 30-Minute Affiliate Consultation",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    description:
      "Free 30-minute consult. Written game plan included. No obligation.",
    eligibleDuration: {
      "@type": "QuantitativeValue",
      value: 30,
      unitCode: "MIN",
    },
  },
  potentialAction: {
    "@type": "ReserveAction",
    name: "Book an affiliate consultation",
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
      name: "Free 30-minute affiliate strategy consultation with Omni AI",
    },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={affiliateConsultServiceSchema} />
      {/* Breadcrumb schema — pairs with the visible Breadcrumb added
          in the page body. 3-level Home → Affiliate Program → Book
          Consultation. /affiliate/info is the live hub URL, so the
          middle crumb is a genuine parent. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Affiliate Program", url: affiliateInfoUrl },
          { name: "Book Consultation", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
