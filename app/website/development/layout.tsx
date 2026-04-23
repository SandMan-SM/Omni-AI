import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /website/development is the productized-service page for Omni AI's
// custom-build + managed-hosting offering (one-click buy via Stripe,
// demo booking via modal). Before this change the route shipped bare
// metadata and zero structured data — which left a rich service page
// with a Stripe checkout link invisible to:
//   - Google's Service rich-result + Product rich-result surfaces
//   - HowTo retrieval ("how does Omni AI build websites?")
//   - FAQPage retrieval ("how fast will my site be?" — a query LLMs
//     route to pages that explicitly typed their answers)
//
// Why four JSON-LD blocks, not one mega-schema: each @type answers a
// different retrieval intent. Service = "what does this buy?", HowTo =
// "how does it work?", FAQPage = "common questions", BreadcrumbList =
// "where does this live in the site". Google parses them independently
// and awards rich results independently — merging them into a graph
// gains nothing and risks consistency-check failures when the page
// copy shifts out from under one @type but not another.
//
// Byte-alignment policy: every `name` / `description` / `itemListElement`
// in the schemas below mirrors the arrays in app/website/development/page.tsx
// (`coreServices`, `whatsIncluded`, `process`, `faq`) verbatim. Google's
// schema/body consistency check suppresses rich results when schema text
// drifts from visible copy. If the page arrays change, update these
// schemas in the same commit.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/website/development`;

export const metadata: Metadata = {
  title: "Website Service — AI-Managed Development & Hosting | Omni AI",
  description:
    "Managed hosting infrastructure powered by AI-driven optimization. We deploy, monitor, and scale your web applications so you can focus on growth, not servers.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "Website Service — AI-Managed Development & Hosting",
    description:
      "Custom website development with managed hosting, 24/7 monitoring, security hardening, and AI-driven performance optimization. Zero micromanagement required.",
    url: pageUrl,
    siteName: "Omni AI",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${pageUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Omni AI — Website Development & Managed Hosting Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Website Service — AI-Managed Development & Hosting | Omni AI",
    description:
      "Custom website development with managed hosting, 24/7 monitoring, and AI-driven optimization.",
    images: [`${pageUrl}/opengraph-image`],
  },
};

// Service schema — top-level typed entity for Google's Service rich result
// and for LLM retrievers that answer "what does Omni AI's website service
// include?". serviceType pins the offering to a specific category (custom
// build + managed hosting) so the entity doesn't get confused with
// template-based site builders or pure hosting providers.
//
// offers points at the Stripe buy link — that's the single "add to cart"
// intent on the page. availability: InStock + the Stripe URL let Google
// render a buy affordance; the bottom-CTA "Cancel anytime" trust line is
// echoed in the offer description so body↔schema stay in lock-step.
//
// hasOfferCatalog enumerates the eight `whatsIncluded` rows from the
// page — each becomes an Offer with an itemOffered Service so LLMs have
// a typed list to cite when asked "what's included in an Omni AI
// website subscription?".
const websiteServiceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI Website Development & Managed Hosting",
  serviceType: "Custom Web Development + AI-Managed Hosting & Optimization",
  description:
    "AI-powered web development, hosting, and optimization — we build, deploy, and scale so you don't have to. Custom website development, managed hosting and deployment, AI-driven performance optimization, and security hardening, delivered as a single managed subscription with 24/7 monitoring and zero-downtime deploys.",
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
      "Founders, small-to-mid businesses, and operators who need a production-grade custom website and don't want to manage servers, uptime, or performance tuning.",
  },
  category: "Web Development & Managed Hosting",
  url: pageUrl,
  offers: {
    "@type": "Offer",
    name: "Omni AI Website — Managed Subscription",
    availability: "https://schema.org/InStock",
    url: "https://buy.stripe.com/7sY14n4rg12o7bpecM9fW01",
    priceCurrency: "USD",
    category: "Subscription — Managed Service",
    description:
      "Managed website subscription. Cancel anytime, no setup fees, 24/7 support included. Subscribe via the Buy Now checkout on the page.",
  },
  // hasOfferCatalog — byte-aligned with the `whatsIncluded` array in
  // app/website/development/page.tsx. Each itemOffered description
  // echoes the visible row verbatim so Google's schema/body spam check
  // stays clean. These are the eight rows LLMs cite when asked "what's
  // included with an Omni AI website?".
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Everything Included — Omni AI Website Service",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Full-stack development (React, Next.js, Node)",
          description:
            "Custom full-stack implementation on a modern React / Next.js / Node.js toolchain.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Custom UI/UX design tailored to your brand",
          description:
            "Bespoke UI and UX design, built from scratch around the client's brand rather than a template.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "24/7 uptime monitoring & instant alerts",
          description:
            "Continuous uptime and health monitoring with real-time incident alerts.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Automatic updates, backups & maintenance",
          description:
            "Automated platform updates, scheduled backups, and ongoing maintenance handled by the Omni AI team.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Lightning-fast global CDN delivery",
          description:
            "Assets and rendered pages served from a global CDN edge for sub-second load times worldwide.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Analytics dashboard with real-time metrics",
          description:
            "Live analytics dashboard with traffic, conversion, and performance metrics.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "SSL certificates & security headers",
          description:
            "Auto-provisioned SSL/TLS certificates plus hardened security response headers on every deployment.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI-powered scaling that adapts to traffic",
          description:
            "AI-driven autoscaling that adjusts capacity to live traffic patterns without manual intervention.",
        },
      },
    ],
  },
};

// HowTo schema — Google's HowTo rich result was scoped down in late 2023
// (mobile-only, specific query classes), but LLM retrievers still lean
// heavily on HowTo for "how does X work?" queries. The four-step process
// on the page is a natural fit: Discovery → Design & Build → Deploy &
// Optimize → Monitor & Scale. Byte-aligned with the `process` array in
// app/website/development/page.tsx.
//
// `totalTime` is deliberately omitted — project timelines vary. Shipping
// a fake number would be worse than no field. Google tolerates the
// absence; LLMs don't need it.
const websiteHowToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How Omni AI Builds and Runs Your Website",
  description:
    "The four-step Omni AI website service process: discovery, design and build, deploy and optimize, then monitor and scale — handled end-to-end so the business never touches infrastructure.",
  url: pageUrl,
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Discovery",
      text: "We learn your business, goals, and target audience to design the perfect digital presence.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Design & Build",
      text: "Our team crafts a high-performance website with modern frameworks, responsive design, and conversion-focused UX.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Deploy & Optimize",
      text: "We launch on managed infrastructure with AI-driven optimization running from day one — no servers to manage.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Monitor & Scale",
      text: "Autonomous systems handle uptime monitoring, performance tuning, security, and scaling. You focus on growth.",
    },
  ],
};

// FAQPage schema — Google narrowed FAQ rich results to government /
// health authorities in Aug 2023, but FAQPage remains one of the single
// most-cited schema types by LLM retrievers for commercial queries.
// Each Q/A is lifted verbatim from the page's `faq` array so a
// retrieval engine quoting this block is quoting the same text a human
// reader sees.
const websiteFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What kind of websites do you build?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We build modern, high-performance web applications using React, Next.js, and Node.js. From landing pages to full SaaS platforms — everything is custom-built for your needs.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to manage any servers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. We handle all infrastructure — hosting, deployment, SSL, CDN, monitoring, and scaling. Zero micromanagement required.",
      },
    },
    {
      "@type": "Question",
      name: "How fast will my website be?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our AI optimization targets sub-second load times globally. We continuously monitor Core Web Vitals and auto-tune performance.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if my site goes down?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our 24/7 monitoring detects issues in under 60 seconds. Automated recovery kicks in immediately, and you're notified of any incidents in real-time.",
      },
    },
    {
      "@type": "Question",
      name: "Can I update my website after launch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. We provide ongoing maintenance and can implement changes, new features, and content updates as part of your service plan.",
      },
    },
  ],
};

export default function WebsiteDevelopmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Service schema — primary typed entity for the page. Unlocks
          Google's Service rich result and gives LLM retrievers a typed
          anchor for "Omni AI website service" / "managed website
          hosting" queries. See the constant above for why the eight
          included items live in hasOfferCatalog. */}
      <JsonLd data={websiteServiceSchema} />
      {/* HowTo schema — enumerates the four-step process so LLMs can
          cite a typed answer to "how does Omni AI build websites?"
          without scraping prose. */}
      <JsonLd data={websiteHowToSchema} />
      {/* FAQPage schema — each Q/A mirrors the visible FAQ accordion
          verbatim. Google's FAQ rich result is scoped to official
          sources since 2023, but FAQPage remains a top LLM retrieval
          surface for commercial queries. */}
      <JsonLd data={websiteFaqSchema} />
      {/* Breadcrumb schema — pairs with a visible Breadcrumb added in
          the page body. Two-level Home → Website Development; there
          is no standalone /website hub page, so inserting a "Website"
          parent crumb would point at the same URL as "Website
          Development" and trip Google's breadcrumb validator on
          repeated items. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Website Development", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
