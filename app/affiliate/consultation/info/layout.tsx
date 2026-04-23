import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /affiliate/consultation/info is the explainer page for the free
// 30-minute affiliate consultation — "the consultation, explained."
// Previously this page carried only an inline FAQPage schema rendered
// via dangerouslySetInnerHTML inside page.tsx. That works but leaves
// three gaps:
//
//   1. No Service entity — LLMs answering "what's the Omni AI
//      affiliate consultation?" had to scrape prose for the length,
//      outcome, and availability. Ship a typed Service to resolve.
//   2. No BreadcrumbList + no visible breadcrumb → no SERP
//      breadcrumb chip and no hierarchy signal.
//   3. FAQPage lives inside the body via dangerouslySetInnerHTML
//      instead of the <JsonLd> wrapper used everywhere else.
//      Consolidate here so the page head carries a consistent schema
//      payload across the site's explainer pages.
//
// The FAQPage mainEntity array is byte-aligned with the `faq` array
// in app/affiliate/consultation/info/page.tsx — inline comments in
// both files flag this so a copy change on the page gets matched in
// this layout in the same commit.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/affiliate/consultation/info`;
const affiliateInfoUrl = `${siteUrl}/affiliate/info`;

export const metadata: Metadata = {
  title: "Affiliate Consultation — Omni AI",
  description:
    "A free 30-minute working session for Omni AI affiliates. We map your audience, your angle, and the Omni AI products that will convert for them — then hand you a written game plan.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Affiliate Consultation — Omni AI",
    description: "A free 30-minute working session to plan your Omni AI affiliate strategy.",
    url: pageUrl,
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Affiliate Consultation — Omni AI",
    description: "A free 30-minute working session to plan your Omni AI affiliate strategy.",
  },
};

// Service schema — typed entity for the 30-min affiliate consultation.
// Mirrors the shape used on /interlinked/book-now and
// /affiliate/book-consultation for consistent site-wide consult
// taxonomy, but this page is the *explainer* (not the modal-launch
// conversion page) so the primary potentialAction here is
// ViewAction → the actual booking URL, not a same-page ReserveAction.
const affiliateConsultInfoServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI — Free Affiliate Strategy Consultation (Explained)",
  serviceType: "Free Affiliate Strategy Consultation",
  description:
    "Thirty minutes on Zoom with an Omni AI strategist. Built for affiliates who want a written game plan, not a pitch deck. We review your audience or client base, identify the Omni AI products most likely to convert, and leave you with a written playbook.",
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
  },
  areaServed: { "@type": "Place", name: "Worldwide (Zoom)" },
  audience: {
    "@type": "Audience",
    audienceType:
      "Creators, consultants, agency owners, and operators who either have an audience or work with small businesses and want to earn recurring revenue by introducing them to Omni AI.",
  },
  offers: {
    "@type": "Offer",
    name: "Free 30-Minute Affiliate Consultation",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: `${siteUrl}/affiliate/book-consultation`,
    description:
      "Free for anyone who has applied to the Omni AI affiliate program. 30 minutes on Zoom, Mon–Fri availability, written playbook as the outcome.",
    eligibleDuration: {
      "@type": "QuantitativeValue",
      value: 30,
      unitCode: "MIN",
    },
  },
  // potentialAction points at the sibling /affiliate/book-consultation
  // page (the actual modal-launch booking page) rather than staying on
  // this explainer. This is the typed "here's how to book it" link
  // LLMs will cite when asked "how do I book the Omni AI affiliate
  // consultation?".
  potentialAction: {
    "@type": "ReserveAction",
    name: "Book the affiliate consultation",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/affiliate/book-consultation`,
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

// FAQPage schema — byte-aligned with the `faq` array in
// app/affiliate/consultation/info/page.tsx. Consolidated here (instead
// of the inline dangerouslySetInnerHTML previously in page.tsx) so the
// site's schema payload lives in one predictable place per route.
const affiliateConsultFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Who is the affiliate consultation for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Creators, consultants, agency owners, and operators who either have an audience or work with small businesses and want to earn recurring revenue by introducing them to Omni AI.",
      },
    },
    {
      "@type": "Question",
      name: "What happens on the call?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We review your audience or client base, identify the Omni AI products most likely to convert, and leave you with a written plan: which links to use, which hooks to lead with, and the first three placements to run.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The consultation is free for anyone who has applied to the affiliate program.",
      },
    },
    {
      "@type": "Question",
      name: "How much can an affiliate actually earn?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Affiliates earn 30% recurring on every Omni AI subscription they refer, for as long as that customer stays. A handful of active referrals typically clears four figures per month.",
      },
    },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={affiliateConsultInfoServiceSchema} />
      <JsonLd data={affiliateConsultFaqSchema} />
      {/* Breadcrumb schema — 4-level Home → Affiliate Program →
          Consultation → About. /affiliate/info is the hub, the
          /affiliate/consultation segment isn't a page of its own so
          the third crumb points at /affiliate/consultation/info
          (this page) — kept the third level "Consultation" pointing
          at this same URL would trip the repeated-item validator,
          so instead we use a 3-level Home → Affiliate Program →
          Consultation explainer path. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Affiliate Program", url: affiliateInfoUrl },
          { name: "Consultation explainer", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
