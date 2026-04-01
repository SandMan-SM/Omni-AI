export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Omni AI",
  alternateName: ["OmniLeads AGI", "Omni Leads AI"],
  url: "https://omnileadsagi.com",
  logo: {
    "@type": "ImageObject",
    url: "https://omnileadsagi.com/favicon.png",
  },
  description:
    "AI-powered autonomous lead generation and business automation platform. Omni AI builds intelligent agents that generate leads, run operations, and scale businesses 24/7.",
  foundingDate: "2024",
  sameAs: [
    "https://www.linkedin.com/company/omni-ai",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@omni.ai",
    url: "https://omnileadsagi.com/join",
    availableLanguage: "English",
  },
  knowsAbout: [
    "Artificial Intelligence",
    "Lead Generation",
    "AI Agents",
    "Marketing Automation",
    "Sales Intelligence",
    "Campaign Management",
    "Business Automation",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Omni AI",
  alternateName: "OmniLeads AGI",
  url: "https://omnileadsagi.com",
  description:
    "AI-powered lead generation and autonomous campaign management platform.",
  publisher: {
    "@type": "Organization",
    name: "Omni AI",
    url: "https://omnileadsagi.com",
  },
  inLanguage: "en-US",
};

export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Omni AI",
  alternateName: "OmniLeads AGI",
  url: "https://omnileadsagi.com",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "AI Lead Generation Platform",
  operatingSystem: "Web-based",
  description:
    "Autonomous AI platform that generates leads, manages campaigns, and scales business operations using intelligent agents. Features AI-generated video marketing, real-time performance ranking, and auto-optimization.",
  image: "https://omnileadsagi.com/og-image.png",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: "https://omnileadsagi.com/join",
    description: "Free tier available",
  },
  featureList: [
    "AI-Powered Lead Generation",
    "Autonomous Campaign Management",
    "AI-Generated Video Marketing",
    "Real-Time Performance Ranking",
    "Auto-Optimization Engine",
    "AI Agent Arena",
    "Multi-Channel Outreach",
    "Analytics Dashboard",
  ],
  review: [
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Marcus Chen" },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody:
        "Omni AI completely transformed how we handle lead generation. What used to take my team 40 hours a week now runs autonomously.",
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "Sarah Mitchell" },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody:
        "The Master tier paid for itself in the first week. I went from drowning in DMs to having conversations that actually convert.",
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "David Park" },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody:
        "We scaled from $50k to $200k monthly revenue in 6 months. The system doesn't just work — it learns and improves constantly.",
    },
  ],
  creator: {
    "@type": "Organization",
    name: "Omni AI",
    url: "https://omnileadsagi.com",
  },
};
