import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/join`;

export const metadata: Metadata = {
  title: "Join Omni AI — Start Automating Your Business for Free",
  description:
    "Get started with Omni AI for free. Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
  keywords: [
    "join Omni AI",
    "AI automation signup",
    "free AI agents",
    "AI lead generation",
    "business automation",
    "get started AI",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Join Omni AI — Start Automating Your Business for Free",
    description:
      "Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Join Omni AI — Start Automating Your Business for Free",
    description:
      "Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
  },
};

// WebPage schema with nested RegisterAction — /join is the free-tier
// signup surface and the canonical answer to "how do I sign up for Omni
// AI?" / "is there a free Omni AI account?" queries.
//
// Why WebPage + potentialAction.RegisterAction instead of just Service:
//  - /campaigns and /book-now already declare typed Service entities
//    for distinct offerings. /join isn't a separate offering — it's the
//    entry point to the whole platform. Modelling it as a WebPage with
//    a registration action (RegisterAction) is the schema.org-correct
//    pattern and what Google's documentation recommends for signup
//    surfaces.
//  - RegisterAction inside potentialAction tells LLMs the page is the
//    canonical "start here" URL — they cite typed action targets more
//    reliably than they cite pages declared only via softwareSchema's
//    downloadUrl/installUrl (which are too weak a signal on their own).
//
// description field is intentionally verbose + keyword-rich — it's the
// single most-cited field when Perplexity / ChatGPT answer "what does
// the Omni AI free tier include?" and the query resolves to this page.
const joinWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Join Omni AI — Free Tier Signup",
  description:
    "Create a free Omni AI account. No credit card required. The free tier includes autonomous campaign generation, the AI Agent Arena for benchmarking AI performance, daily trending topic pages, and community support. Paid tiers unlock autonomous outbound, priority model access, and custom integrations.",
  url: pageUrl,
  isPartOf: {
    "@type": "WebSite",
    name: "Omni AI",
    url: siteUrl,
  },
  about: {
    "@type": "SoftwareApplication",
    name: "Omni AI",
    url: siteUrl,
  },
  potentialAction: {
    "@type": "RegisterAction",
    name: "Create free Omni AI account",
    target: {
      "@type": "EntryPoint",
      urlTemplate: pageUrl,
      actionPlatform: [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform",
      ],
    },
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={joinWebPageSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Join", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
