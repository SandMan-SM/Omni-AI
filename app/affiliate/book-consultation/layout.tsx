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

// WebPage schema paired with the Service above. speakable is only
// valid on WebPage / CreativeWork — Service is not a CreativeWork
// descendant. The page auto-opens an AffiliateConsultationModal on
// load (useState(true) in page.tsx), which means JS-driven voice
// scrapers never see the modal content — they read the server-
// rendered h1 + subtitle. That makes speakable especially valuable
// here: voice assistants answering "how do I book an Omni AI
// affiliate consultation?" read h1 + subtitle aloud from the static
// HTML, even though the visible funnel is behind a modal.
//
// about: { Service, url } edge binds this to
// affiliateConsultServiceSchema so voice retrievers can walk from
// the hero speakable reply into the Service's Offer + ReserveAction
// body for the follow-up "what do I get?" / "is it free?" queries.
//
// Matches the split-schema pattern used on /interlinked/book-now,
// /arena, /sponsor/info, /book-now, /affiliate/info,
// /interlinked/premium, /newsletter/premium/info.
const bookConsultationWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Book an Affiliate Consultation · Omni AI",
  description:
    "Landing page for the free 30-minute Omni AI affiliate strategy consultation. A modal-launch conversion page — the body auto-opens AffiliateConsultationModal so visitors can pick a time, but the static h1 + subtitle are the voice-retrieval surface.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  about: {
    "@type": "Service",
    name: "Omni AI — Free Affiliate Strategy Consultation",
    url: pageUrl,
  },
  // SpeakableSpecification — voice assistants asked "how do I book an
  // Omni AI affiliate consultation?" / "what is the Omni AI affiliate
  // consultation?" read h1 ("Book your affiliate consultation") plus
  // the subtitle tagged with data-speakable="intro" in
  // app/affiliate/book-consultation/page.tsx ("A 30-minute working
  // session to map out how you'll earn with the Omni AI affiliate
  // program.") as the natural ~9-second hero-intent voice reply.
  // Compact because the page body itself is brief (modal-launch
  // conversion page); the Service + ReserveAction wiring on the
  // sibling schema carries the deeper "what do I get?" body.
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "[data-speakable='intro']"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* WebPage schema with speakable — speakable is only valid on
          WebPage / CreativeWork (not Service). See the constant above
          for why this split-schema pattern matters on a modal-launch
          page: voice scrapers never see the modal, they read the
          server-rendered hero. */}
      <JsonLd data={bookConsultationWebPageSchema} />
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
