import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /affiliate/sign-up is the modal-launch landing page for the
// AffiliateSignupModal — a 60-second application form that onboards
// new Omni AI affiliates (30% recurring commission, no fees, paid
// monthly). The page itself is a thin wrapper (hero H1 + sub-copy +
// auto-open modal) so the schema is what carries the retrieval
// signal:
//
//   - Service entity with a commission-in-description Offer — answers
//     "how much do Omni AI affiliates earn?" / "sign up Omni AI
//     affiliate" queries with a typed object.
//   - RegisterAction — matches the conversion-page action taxonomy
//     used on /sponsor/application and /join.
//   - 3-level BreadcrumbList — Home → Affiliate Program → Sign Up.
//     /affiliate/info is the live hub URL.
//
// Commission terms live in Offer.description (and Offer.eligibleDuration
// for the "lifetime" cadence) rather than Offer.price because percentage
// commissions can't be expressed as a currency amount — same pattern
// already used on /affiliate/info's affiliateServiceSchema.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/affiliate/sign-up`;
const affiliateInfoUrl = `${siteUrl}/affiliate/info`;

export const metadata: Metadata = {
  title: "Sign Up as an Omni AI Affiliate",
  description:
    "Join the Omni AI affiliate program in under a minute. Earn 30% recurring on every client you refer — no fees, no caps, paid monthly.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Sign Up as an Omni AI Affiliate",
    description:
      "Earn 30% recurring on every client you refer. Apply in 60 seconds.",
    url: pageUrl,
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign Up as an Omni AI Affiliate",
    description: "30% recurring commissions. 60-second signup.",
  },
};

// Service schema for affiliate signup.
//
// Why description (not price) for the 30% commission: Schema.org
// Offer.price expects a currency amount. A percentage can't be
// expressed as "30 USD" without misleading Google's price chip.
// Commission terms go in Offer.description; eligibleDuration uses the
// 99 ANN idiom for "lifetime" (no hard fixed end date, recurring as
// long as the referred client stays).
const affiliateSignupServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI Affiliate Program — Signup",
  serviceType: "Affiliate / Partner Referral Program Signup",
  description:
    "Join the Omni AI affiliate program in under a minute. Every person who signs up as an Omni AI client through your unique tracked link earns you 30% of their subscription — every month they stay. No fees, no minimums, no gatekeeping. Paid monthly via direct deposit or PayPal on a Net-30 schedule.",
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
      "Creators, consultants, operators, newsletter publishers, and anyone with an audience or client list who already talks about AI or business operations and wants to convert warm referrals into recurring revenue.",
  },
  offers: {
    "@type": "Offer",
    name: "30% Recurring Commission on Every Referred Client",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    description:
      "30% recurring commission on every Omni AI client you refer — paid every month the client stays, with a 90-day first-touch attribution cookie and Net-30 payouts.",
    eligibleDuration: {
      "@type": "QuantitativeValue",
      value: 99,
      unitCode: "ANN",
    },
  },
  potentialAction: {
    "@type": "RegisterAction",
    name: "Sign up as an Omni AI affiliate",
    target: {
      "@type": "EntryPoint",
      urlTemplate: pageUrl,
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    result: {
      "@type": "Registration",
      name: "Omni AI affiliate account with a tracked referral link",
    },
  },
};

// WebPage schema paired with the Service above. Speakable is only
// valid on WebPage / CreativeWork descendants — Service is not a
// CreativeWork subtype, so the Service schema can't carry speakable
// directly. Split-schema pattern: WebPage owns the voice-retrieval
// selectors, Service owns the offering / commission / action body.
//
// Voice-retrieval surface: /affiliate/sign-up auto-opens the
// AffiliateSignupModal on load (useState(true) in page.tsx), which
// means JS-disabled voice scrapers never see the modal content —
// they read the server-rendered h1 + subtitle only. That makes
// speakable especially valuable here: it's the ONLY voice-retrieval
// surface on the page.
//
// Voice queries served: "how do I sign up as an Omni AI affiliate?"
// / "how much do Omni AI affiliates earn?" / "how do I become an
// Omni AI affiliate?" read h1 ("Sign up as an Omni AI Affiliate") +
// the subtitle tagged data-speakable="intro" ("Earn 30% recurring
// on every client you refer. The form is open below.") as the
// natural ~8-second orientation reply. Deeper "what are the terms?"
// / "do you pay monthly?" queries walk the about-edge into the
// Service's Offer.description (commission percentage + Net-30 +
// 90-day attribution).
//
// about: { Service, url } edge binds this WebPage to the Service
// schema above so Google and LLM retrievers have a typed graph walk
// from the voice surface into the commission-terms body.
//
// Matches the split-schema pattern shipped on /affiliate/book-consultation,
// /interlinked/book-now, /sponsor/application, /sponsor/info,
// /newsletter/premium/info, /book-now, /affiliate/info — every
// Service-backed conversion page on the site carries a WebPage
// speakable wrapper.
const affiliateSignupWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sign Up as an Omni AI Affiliate · Omni AI",
  description:
    "Modal-launch landing page for the Omni AI Affiliate Program signup form. 60-second onboarding for creators, consultants, and operators who want to earn 30% recurring commission on referred clients. The static h1 and subtitle are the voice-retrieval surface; the modal form handles conversion.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  about: {
    "@type": "Service",
    name: "Omni AI Affiliate Program — Signup",
    url: pageUrl,
  },
  // SpeakableSpecification — hero-intent voice reply. The page body
  // is brief by design (modal-launch conversion page), so the h1 +
  // subtitle pair carry the entire orientation reply. Voice
  // assistants asked "how do I sign up as an Omni AI affiliate?" /
  // "how much do Omni AI affiliates earn?" read h1 ("Sign up as an
  // Omni AI Affiliate") + the subtitle tagged data-speakable="intro"
  // in app/affiliate/sign-up/page.tsx ("Earn 30% recurring on every
  // client you refer. The form is open below.") as the natural
  // ~8-second reply. The Service sibling's Offer.description carries
  // the deeper "what are the payout terms?" body for voice queries
  // that walk the about-edge.
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
      <JsonLd data={affiliateSignupWebPageSchema} />
      <JsonLd data={affiliateSignupServiceSchema} />
      {/* Breadcrumb schema — pairs with the visible Breadcrumb in
          the page body. 3-level Home → Affiliate Program → Sign Up,
          with /affiliate/info as the live hub parent. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Affiliate Program", url: affiliateInfoUrl },
          { name: "Sign Up", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
