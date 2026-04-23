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

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
