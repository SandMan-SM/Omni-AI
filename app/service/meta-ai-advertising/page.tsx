import type { Metadata } from "next";
import { MetaAiAdvertisingClient } from "./MetaAiAdvertisingClient";

const pageUrl = "https://omnileadsagi.com/service/meta-ai-advertising";
const socialImageUrl =
  "https://omnileadsagi.com/service/meta-ai-advertising/meta-ai-advertising-og.png";

export const metadata: Metadata = {
  title: "Meta AI Advertising Services | Omni AI",
  description:
    "Reserve a Meta AI advertising engagement, add conversion API integration, or connect the full CRM follow-up stack with SMS and email.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Meta AI Advertising Services | Omni AI",
    description:
      "Three focused Meta AI advertising packages, from campaign management to full API and CRM integration.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: "Omni AI Meta advertising system connecting Facebook, Instagram, and Messenger to customer follow-up",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta AI Advertising Services | Omni AI",
    description:
      "Meta AI advertising, conversion API integration, and CRM follow-up in one focused service stack.",
    images: [socialImageUrl],
  },
  robots: { index: true, follow: true },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Meta AI Advertising",
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: "https://omnileadsagi.com",
  },
  url: pageUrl,
  image: socialImageUrl,
  description:
    "Meta AI advertising services with optional conversion API and CRM integration.",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Meta AI Advertising Packages",
    itemListElement: [
      { "@type": "Offer", name: "Meta AI Advertising", price: "1500", priceCurrency: "USD" },
      {
        "@type": "Offer",
        name: "Meta AI Advertising + API Integration",
        price: "2500",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Meta AI + API + CRM (SMS, Email)",
        price: "3500",
        priceCurrency: "USD",
      },
    ],
  },
};

export default function MetaAiAdvertisingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <MetaAiAdvertisingClient />
    </>
  );
}
