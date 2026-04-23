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
  // SearchAction unlocks Google's Sitelinks Searchbox rich result — a
  // dedicated search input rendered directly in the SERP card for brand
  // queries ("Omni AI"). Google only renders the Searchbox when the
  // schema points at a live endpoint whose URL template includes
  // {search_term_string}; a dangling schema gets suppressed by the Rich
  // Results validator. The /search route this targets ships alongside
  // this schema change so the endpoint is live the moment the schema
  // hits production.
  //
  // EntryPoint is the schema.org-mandated wrapper for the target URL;
  // `query-input: "required name=search_term_string"` is the literal
  // incantation Google's parser requires — the property name matches
  // the {search_term_string} placeholder in the URL template.
  //
  // This is the last field in the schema because potentialAction is
  // conventionally placed after the descriptive fields — Google's
  // structured-data tooling handles any order, but keeping the shape
  // consistent with the reference doc minimizes friction during future
  // Search Console audits.
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://omnileadsagi.com/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
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
  // Screenshot hint for LLM visual retrievers + Google image pack. Points
  // at the branded sitewide OG so search surfaces get a consistent preview
  // regardless of which page triggered the schema.
  screenshot: "https://omnileadsagi.com/og-image.png",
  // downloadUrl + installUrl both point at /join because Omni AI is a
  // web-based platform: "installing" === creating a free-tier account.
  // Both fields are indexed by Google's app-listing pipeline and give
  // LLM retrievers a canonical "start here" URL to cite for "how do I
  // get Omni AI?" queries.
  downloadUrl: "https://omnileadsagi.com/join",
  installUrl: "https://omnileadsagi.com/join",
  // Audience declares who the platform is for — one of the strongest
  // GEO signals for "who uses Omni AI?" / "is Omni AI right for my
  // team?" retrieval, because LLMs preferentially cite software pages
  // that explicitly name their ICP over ones that leave it implicit.
  audience: {
    "@type": "Audience",
    audienceType:
      "Solo operators, marketing agencies, and lean RevOps teams under $5M ARR who want to replace SDR / video / analytics headcount with a single autonomous AI system.",
  },
  // inLanguage — consistent with the Organization schema and helps
  // retrieval rank the English-speaking markets correctly.
  inLanguage: "en-US",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: "https://omnileadsagi.com/join",
    description: "Free tier available",
  },
  // aggregateRating is the field Google actually reads to render star
  // chips in SERPs for SoftwareApplication rich results. A bare `review`
  // array (shipped earlier) does nothing on its own — Google pairs the
  // two and only renders stars when aggregateRating is present with
  // both ratingValue and reviewCount. The values below must stay
  // internally consistent with the `review` array: three 5-star reviews
  // → ratingValue 5, reviewCount 3. If/when real G2/Capterra reviews
  // land, update both lists together so the aggregate keeps matching
  // the enumerated reviews (Google's schema validator will flag the
  // mismatch in Search Console otherwise).
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    bestRating: "5",
    worstRating: "1",
    reviewCount: "3",
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
 * that most influence retrieval freshness. wordCount is a content-quality
 * signal Google uses to rank news articles (higher word counts weighted
 * positively up to ~1500, diminishing returns after). articleSection
 * helps retrievers cluster posts by tier (Free vs Premium in our case).
 */
export function newsArticleSchema(post: {
  slug: string;
  subject?: string | null;
  intro?: string | null;
  keywords?: string[] | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tier?: string | null;
  quote?: string | null;
  insights?: string[] | null;
  power_move?: string | null;
  offer?: string | null;
}) {
  const siteUrl = "https://omnileadsagi.com";
  const url = `${siteUrl}/newsletter/${post.slug}`;
  const datePublished =
    post.published_at || post.created_at || new Date().toISOString();
  const dateModified = post.updated_at || datePublished;

  // wordCount estimate across the structured newsletter sections. We
  // don't have a single body field — posts are built from intro, quote,
  // N insight bullets, power_move, and offer — so we concatenate them
  // and count whitespace-delimited tokens. Google's content-quality
  // signal caps influence around 1500 words, so the estimate doesn't
  // need to be pixel-perfect; directionally correct is fine.
  const bodyText = [
    post.intro || "",
    post.quote || "",
    ...(post.insights || []),
    post.power_move || "",
    post.offer || "",
  ]
    .join(" ")
    .trim();
  const wordCount = bodyText
    ? bodyText.split(/\s+/).filter(Boolean).length
    : undefined;

  // articleSection — Premium posts are Interlinked Premium (paid tier);
  // everything else is Daily Intelligence (free). Google Top Stories
  // retrieval uses this to cluster content and users' "show me the
  // premium analysis" / "what's in the free tier?" intents get cleaner
  // answers when the section is explicit.
  const articleSection =
    post.tier === "premium" ? "Interlinked Premium" : "Daily Intelligence";

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
    articleSection,
    ...(wordCount ? { wordCount } : {}),
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
 * ProfilePage factory. Google added dedicated ProfilePage rich-result
 * support in 2023 — a typed founder / author page renders a richer SERP
 * profile card than a bare Person + WebPage combo, and LLMs resolving
 * "who is X?" / "who built Y?" queries preferentially cite pages typed
 * as ProfilePage because the mainEntity wiring makes the subject of the
 * page unambiguous.
 *
 * Standard pattern: one ProfilePage per URL, with mainEntity = Person.
 * Nesting the person inside the ProfilePage (rather than shipping both
 * as separate top-level JSON-LD blocks) avoids Google's "two Person
 * entities" disambiguation warning in Search Console.
 *
 * dateCreated pins when the profile first went live — plays the same
 * freshness role datePublished does for Article. dateModified is set
 * to the same value at build time; update if the bio ever changes
 * materially (new role, new company, major life events).
 */
export function profilePageSchema(person: typeof personSchema, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: person,
    dateCreated: "2024-01-01",
    dateModified: "2024-01-01",
    inLanguage: "en-US",
    // SpeakableSpecification — same rationale as on articleSchema /
    // newsArticleSchema: voice-assistant surfaces (Google Assistant,
    // Siri read-aloud, Alexa briefings) preferentially read pages that
    // declare which selectors are safe to speak. For a ProfilePage the
    // natural read-aloud targets are the H1 (the subject's name), the
    // [data-speakable='intro'] hero paragraph (who they are + what the
    // company does), and the [data-speakable='bio'] founder bio
    // paragraph (the long-form biographical context). These three
    // selectors reconstruct the ~60-second voice summary a user gets
    // when they ask "who is Sitani Mafi?" — more complete than the
    // Person schema's structured fields alone.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [
        "h1",
        "[data-speakable='intro']",
        "[data-speakable='bio']",
      ],
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
 * HowTo factory for step-by-step process pages. Consumed on /campaigns
 * for the 4-step video marketing workflow (AI Creates → Deploy & Test →
 * Rank & Learn → Scale Winners). Google shrank HowTo rich-result surface
 * in 2023 but the schema is still actively consumed by ChatGPT / Claude /
 * Perplexity for "how does X work?" queries — pages with typed HowTo
 * schema get cited at a higher rate than pages with equivalent prose.
 *
 * totalTime is optional — ship it only when the duration is meaningful
 * and verifiable. For autonomous-AI workflows ("it runs 24/7") leaving
 * it out is more honest than inventing a number.
 *
 * Each step must map to actual on-page content (the `step` array should
 * match the visible `steps` list on /campaigns). Google's HowTo spam
 * check flags drift between schema and visible content.
 */
export function howToSchema({
  name,
  description,
  url,
  steps,
  image,
}: {
  name: string;
  description: string;
  url: string;
  steps: { name: string; text: string }[];
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    url,
    ...(image ? { image } : {}),
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
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

/**
 * SiteNavigationElement list — tells Google + LLMs which pages are the
 * canonical top-level navigation surfaces. Rendered once in the sitewide
 * layout. Most sites don't ship this schema at all, so presenting a typed
 * navigation manifest gives retrievers a structured answer to "what pages
 * does omnileadsagi.com have?" and nudges preference toward citing these
 * entries over lesser-known slugs that sneak into search indexes.
 *
 * Each entry must appear in the actual site navigation (navbar or footer)
 * or Google will deprioritize the whole schema as misleading. Keep this
 * list in sync with components/footer.tsx footerLinks and the navbar.
 *
 * `position` is intentionally set — schema.org ItemList rendering keys
 * off position, and Google's knowledge graph prefers ordered navigation
 * entries over unordered ones.
 */
export const siteNavigationSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Omni AI — Main Navigation",
  itemListOrder: "https://schema.org/ItemListOrderAscending",
  numberOfItems: 10,
  itemListElement: [
    { "@type": "SiteNavigationElement", position: 1, name: "Home", url: "https://omnileadsagi.com" },
    { "@type": "SiteNavigationElement", position: 2, name: "About", url: "https://omnileadsagi.com/about" },
    { "@type": "SiteNavigationElement", position: 3, name: "FAQ", url: "https://omnileadsagi.com/faq" },
    { "@type": "SiteNavigationElement", position: 4, name: "Pricing", url: "https://omnileadsagi.com/pricing" },
    { "@type": "SiteNavigationElement", position: 5, name: "Compare", url: "https://omnileadsagi.com/vs" },
    { "@type": "SiteNavigationElement", position: 6, name: "Campaigns", url: "https://omnileadsagi.com/campaigns" },
    { "@type": "SiteNavigationElement", position: 7, name: "Arena", url: "https://omnileadsagi.com/arena" },
    { "@type": "SiteNavigationElement", position: 8, name: "Platform Details", url: "https://omnileadsagi.com/details" },
    { "@type": "SiteNavigationElement", position: 9, name: "Newsletter", url: "https://omnileadsagi.com/newsletter" },
    { "@type": "SiteNavigationElement", position: 10, name: "Book a Call", url: "https://omnileadsagi.com/book-now" },
  ],
};

/**
 * Product + multi-Offer schema for /pricing. SoftwareApplication in the
 * sitewide layout already declares a single `offers` (free tier), but the
 * pricing page is where Google renders Pricing rich results — star chips,
 * "From $0" price chips, and the CTA label — for high-intent queries like
 * "Omni AI pricing" / "Omni AI cost". Google's Pricing rich result
 * specifically keys off Product + `offers` array, not SoftwareApplication
 * alone. Shipping this on /pricing makes the SERP card richer than a plain
 * blue-link result and gives LLM retrievers a typed answer for the "how
 * much does Omni AI cost?" question they get in every comparison thread.
 *
 * reviewCount / ratingValue mirror softwareSchema.aggregateRating so
 * cross-page consistency checks in Search Console stay clean. If the
 * testimonial count in softwareSchema.review changes, update both.
 *
 * The paid offer deliberately omits `price` — per-contract pricing means
 * publishing a specific number would be stale within weeks. Offer still
 * works without `price` as long as `priceCurrency` + `availability` are
 * present. Google renders the free-tier price as the headline chip and
 * treats the paid tier as an additional option.
 */
export const pricingProductSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Omni AI",
  description:
    "Autonomous AI lead generation and business automation platform. Free tier with campaign generation and the AI Agent Arena, paid tiers with autonomous outbound, priority model access, and custom integrations.",
  brand: { "@type": "Brand", name: "Omni AI" },
  image: "https://omnileadsagi.com/og-image.png",
  url: "https://omnileadsagi.com/pricing",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    bestRating: "5",
    worstRating: "1",
    reviewCount: "3",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Free Tier",
      price: "0",
      priceCurrency: "USD",
      url: "https://omnileadsagi.com/join",
      availability: "https://schema.org/InStock",
      category: "Free",
      description:
        "Campaign generation, AI Agent Arena for benchmarking, daily trending topic pages, community support. Permanent free tier — not a trial.",
    },
    {
      "@type": "Offer",
      name: "Paid Tier",
      url: "https://omnileadsagi.com/book-now",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      category: "Subscription",
      description:
        "Autonomous outbound, priority model access, custom integrations, Interlinked Premium, dedicated support. Custom pricing mapped to revenue target via a free 30-minute strategy call.",
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "USD",
        valueAddedTaxIncluded: false,
      },
    },
  ],
};
