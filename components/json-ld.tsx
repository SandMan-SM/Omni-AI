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
    email: "sitanim8@gmail.com",
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
  founder: {
    "@type": "Person",
    name: "Sitani Mafi",
    url: "https://omnileadsagi.com/about",
    jobTitle: "Founder",
  },
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

/**
 * Founder / author entity. Consumed on the homepage, /about, and as the
 * `author` field inside newsArticleSchema() so every newsletter post has a
 * real human byline — critical for E-E-A-T and for LLMs that prefer to cite
 * content with a named author.
 *
 * sameAs is intentionally sparse today — see plan T2.6: once X / Crunchbase /
 * G2 / YouTube / Product Hunt profiles exist, append them here. Stale 404s
 * in sameAs hurt validation, so keep this list truthful.
 */
export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Sitani Mafi",
  jobTitle: "Founder",
  email: "sitanim8@gmail.com",
  url: "https://omnileadsagi.com/about",
  worksFor: {
    "@type": "Organization",
    name: "Omni AI",
    url: "https://omnileadsagi.com",
  },
  knowsAbout: [
    "AI Lead Generation",
    "Marketing Automation",
    "Business Automation",
    "AI Agents",
    "Autonomous Operations",
  ],
  sameAs: [] as string[],
};

/**
 * Article schema for /[slug] trending landing pages. Stronger than bare
 * WebPage — Google rich results and LLM retrieval both prefer typed Article
 * with named author + publisher + image + datePublished.
 */
export function articleSchema(page: {
  slug: string;
  title?: string | null;
  topic?: string | null;
  description?: string | null;
  date?: string | null;
}) {
  const siteUrl = "https://omnileadsagi.com";
  const url = `${siteUrl}/${page.slug}`;
  const headline = page.title || page.topic || "";
  const topic = page.topic || "";
  const ogImage = `${siteUrl}/api/og?slug=${page.slug}&title=${encodeURIComponent(
    headline
  )}&topic=${encodeURIComponent(topic)}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description: page.description || "",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: ogImage,
    datePublished: page.date || new Date().toISOString(),
    author: {
      "@type": "Person",
      name: "Sitani Mafi",
      url: `${siteUrl}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
    },
    inLanguage: "en-US",
    // SpeakableSpecification tells voice-assistant surfaces (Google
    // Assistant "News" briefings, Siri read-aloud, Alexa Flash Briefings)
    // which CSS selectors to read verbatim. Marking only the H1 + the
    // intro paragraph keeps the briefing tight and quotable. Most sites
    // don't ship this field at all, so shipping it is cheap competitive
    // edge for voice-surface retrieval of daily trending posts.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "[data-speakable='intro']"],
    },
    ...(topic ? { about: { "@type": "Thing", name: topic } } : {}),
  };
}

/**
 * NewsArticle schema for /newsletter/[slug] posts. NewsArticle is a stricter
 * subtype of Article — Google Top Stories eligibility + LLM "latest news"
 * retrieval both key off it. keywords + dateModified are the two fields
 * that most influence retrieval freshness.
 */
export function newsArticleSchema(post: {
  slug: string;
  subject?: string | null;
  intro?: string | null;
  keywords?: string[] | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}) {
  const siteUrl = "https://omnileadsagi.com";
  const url = `${siteUrl}/newsletter/${post.slug}`;
  const datePublished =
    post.published_at || post.created_at || new Date().toISOString();
  const dateModified = post.updated_at || datePublished;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.subject || "Interlinked by Omni AI",
    description: (post.intro || "").slice(0, 200),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished,
    dateModified,
    keywords: (post.keywords || []).join(", "),
    author: {
      "@type": "Person",
      name: "Sitani Mafi",
      url: `${siteUrl}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
    },
    inLanguage: "en-US",
    // SpeakableSpecification — same rationale as the articleSchema
    // field: voice-assistant news briefings (Google Assistant, Siri
    // read-aloud) preferentially surface articles that declare which
    // selectors are safe to read aloud. The H1 + the lede paragraph
    // are what a reader would naturally hear first, so marking those
    // two keeps the briefing concise and on-brand.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "[data-speakable='intro']"],
    },
    isPartOf: {
      "@type": "Periodical",
      name: "Interlinked by Omni AI",
      url: `${siteUrl}/newsletter`,
    },
  };
}

/**
 * FAQPage factory. Consumed on /faq and inlined on the homepage. These are
 * the exact questions LLMs get asked about Omni AI — answering them in
 * schema form is the single highest-leverage move for ChatGPT / Perplexity
 * citations.
 */
export function faqPageSchema(
  qas: { question: string; answer: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map((qa) => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: qa.answer,
      },
    })),
  };
}

/**
 * BreadcrumbList factory — small polish that tells Google and LLMs the site
 * hierarchy. Used on content pages that live more than one level deep.
 */
export function breadcrumbSchema(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * ItemList factory for archive / index pages. Consumed on /newsletter
 * (the Interlinked archive) so Google and LLM retrievers see the page
 * as a structured list of articles rather than an undifferentiated blob
 * of post links. "Latest Omni AI newsletter", "recent Interlinked issues"
 * queries get a typed answer to retrieve.
 *
 * Each item is a positioned ListItem with a nested `url` so retrievers
 * can walk the list and cite individual issues. Keep the item count
 * modest (the caller slices to 20) — longer lists dilute per-item rank
 * without helping discovery.
 */
export function itemListSchema({
  name,
  description,
  url,
  items,
}: {
  name: string;
  description?: string;
  url: string;
  items: { name: string; url: string; description?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    ...(description ? { description } : {}),
    url,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: item.url,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}
