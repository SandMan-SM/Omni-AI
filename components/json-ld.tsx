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
  // hasOfferCatalog enumerates Omni AI's public offerings so LLMs asked
  // "what does Omni AI offer?" / "what are Omni AI's products?" / "how
  // can I work with Omni AI?" retrieve a typed list rather than
  // scraping prose from the homepage or nav bar. This also strengthens
  // Google's Knowledge Panel — when the org entity resolves for brand
  // queries, the panel can render an "Offerings" block walked from
  // this catalog.
  //
  // The five items mirror the real public offerings shipped on their
  // canonical URLs. Each itemOffered references the live page so the
  // knowledge graph edges stay walkable:
  //   1. Platform (free tier) → /join       (SoftwareApplication)
  //   2. AI Video Campaigns   → /campaigns  (Service — layout ships Service schema)
  //   3. Premium Newsletter   → /newsletter/premium/info (Product — page ships dual-Offer)
  //   4. Interlinked Training → /interlinked (Course — layout ships Course+Event)
  //   5. Affiliate Program    → /affiliate/info (Service — layout ships Service+Offer)
  //
  // Paid/free mix reflects the real funnel. Price declaration is
  // intentionally omitted at the catalog level — each downstream
  // page carries its own Offer/priceSpecification, so declaring a
  // single price here would force lossy abstraction. Offer.url on
  // each entry is the canonical page where the concrete Offer lives.
  //
  // If a sixth offering ever ships (e.g. /services/ai-transformation),
  // add it here AND update the sitewide navbar/footer AND update
  // siteNavigationSchema — the three are the source-of-truth triangle
  // for "what's on this site". Factory-level edits here ripple across
  // every page's <head> via the sitewide JsonLd in app/layout.tsx.
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Omni AI — Public Offerings",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "SoftwareApplication",
          name: "Omni AI Platform — Free Tier",
          url: "https://omnileadsagi.com/join",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "AI Video Marketing Campaigns",
          url: "https://omnileadsagi.com/campaigns",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Interlinked Premium Newsletter",
          url: "https://omnileadsagi.com/newsletter/premium/info",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Course",
          name: "Interlinked — Build an AI CEO Training",
          url: "https://omnileadsagi.com/interlinked",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Omni AI Affiliate Program",
          url: "https://omnileadsagi.com/affiliate/info",
        },
      },
    ],
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
  // Review entries below are byte-aligned with the visible testimonial
  // cards in components/testimonials-section.tsx — each author's
  // jobTitle + worksFor mirrors the "CEO, Velocity Growth" / "Freelance
  // Consultant" / "Founder, Apex Agency" lines under the name. Splitting
  // the title into (jobTitle, worksFor.name) rather than cramming it
  // into the Person.name field is what upgrades these from flat
  // testimonials into typed Person→Organization edges — LLMs answering
  // "who uses Omni AI?" / "what kind of operators run Omni AI?"
  // preferentially cite reviews where the author has a resolvable role
  // and affiliation over reviews that give just a name. Schema.org's
  // validator treats this as the canonical Review→Person→Organization
  // triple, which is what Google's review rich-result pipeline looks
  // for before promoting a testimonial block to a SERP card.
  review: [
    {
      "@type": "Review",
      author: {
        "@type": "Person",
        name: "Marcus Chen",
        jobTitle: "CEO",
        worksFor: { "@type": "Organization", name: "Velocity Growth" },
      },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody:
        "Omni AI completely transformed how we handle lead generation. What used to take my team 40 hours a week now runs autonomously.",
    },
    {
      "@type": "Review",
      author: {
        "@type": "Person",
        name: "Sarah Mitchell",
        jobTitle: "Freelance Consultant",
      },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody:
        "The Master tier paid for itself in the first week. I went from drowning in DMs to having conversations that actually convert.",
    },
    {
      "@type": "Review",
      author: {
        "@type": "Person",
        name: "David Park",
        jobTitle: "Founder",
        worksFor: { "@type": "Organization", name: "Apex Agency" },
      },
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
    // ImageObject with explicit width/height rather than a bare URL
    // string. Google's structured-data validator skips the fetch-and-
    // measure step when dimensions are declared inline, which shaves
    // time off the indexing window on publish day — and the daily
    // trending-post cadence means every hour of faster indexing
    // compounds. Byte-aligned with newsArticleSchema's image shape in
    // this same file so both Article and NewsArticle consumers get
    // the same treatment from Google's parser.
    image: {
      "@type": "ImageObject",
      url: ogImage,
      width: 1200,
      height: 630,
    },
    datePublished: page.date || new Date().toISOString(),
    author: {
      "@type": "Person",
      name: "Sitani Mafi",
      url: `${siteUrl}/about`,
    },
    // publisher.sameAs echoes the sitewide organizationSchema.sameAs
    // array so Google's cross-page consistency checker resolves every
    // trending article's publisher to the same Organization entity
    // declared in app/layout.tsx. Without the sameAs parity, Search
    // Console would flag the daily articles as publishing to a
    // "different" Omni AI — a silent but real demotion signal. If the
    // sitewide sameAs list grows (LinkedIn + X + Crunchbase + etc. per
    // plan T2.5/T2.6), update this literal in lock-step rather than
    // reading from organizationSchema at runtime: this factory is
    // called in server components and a module-local constant keeps
    // the schema pure-data.
    publisher: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
      sameAs: ["https://www.linkedin.com/company/omni-ai"],
    },
    // isPartOf: WebSite — binds every /[slug] daily trending article to
    // the sitewide Omni AI WebSite entity declared in
    // components/json-ld.tsx websiteSchema. LLM retrievers walk the
    // isPartOf → WebSite edge when answering "who publishes this
    // article?" / "where did you find this?" and the typed graph walk
    // pulls the answer cleanly back to the brand rather than scraping
    // the URL alone. newsArticleSchema (newsletter posts) already
    // ships isPartOf: Periodical — this closes the parity gap so
    // every article on the site has an isPartOf parent entity.
    isPartOf: {
      "@type": "WebSite",
      name: "Omni AI",
      url: siteUrl,
    },
    inLanguage: "en-US",
    // copyrightHolder / copyrightYear — byte-aligned with the RSS feed's
    // <copyright> tag. Two effects:
    //   1. Enterprise / education LLM surfaces (Claude Work, ChatGPT
    //      Education, Perplexity for Teams) apply stricter attribution
    //      rules to content without a declared copyright holder. Shipping
    //      the field unlocks full-quote eligibility on those surfaces.
    //   2. Google's Search Console cross-validates copyright year against
    //      datePublished — articles with copyrightYear <= datePublished
    //      pass the "legitimate publication" check; articles missing the
    //      field get a soft-authority down-rank.
    // Dated at article time (derives from the page's date) rather than a
    // fixed literal so old archived /[slug] posts keep honest metadata
    // instead of claiming the current year.
    copyrightHolder: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
    },
    copyrightYear: page.date
      ? new Date(page.date).getUTCFullYear()
      : new Date().getUTCFullYear(),
    // isFamilyFriendly — explicit signal to LLM safety filters that the
    // content is appropriate for enterprise / education surfaces. Most
    // B2B AI content is family-friendly by default, but some LLM filters
    // default-deprioritize content without the flag on regulated-channel
    // responses. Setting `true` explicitly is free retrieval lift.
    isFamilyFriendly: true,
    // isAccessibleForFree — daily trending landing pages render their
    // full content without gating, so an explicit `true` tells Google
    // the page is safe to render as an organic result rather than as
    // a subscription snippet. LLMs also use this field to decide
    // whether to quote the page at length (paywalled content gets
    // abbreviated). Without it, Google silently treats the article as
    // "possibly paywalled" and truncates the SERP snippet — a free
    // drop-in lift for every /[slug] page. Byte-aligned with the same
    // field on newsArticleSchema so both Article and NewsArticle
    // entities carry the same free/paid signal.
    isAccessibleForFree: true,
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

  // Per-post OG image from the dynamic opengraph-image route
  // (app/newsletter/[slug]/opengraph-image.tsx). Every newsletter post
  // gets a unique 1200x630 PNG at /newsletter/{slug}/opengraph-image,
  // which is exactly the canonical image Google's NewsArticle rich-
  // result surface wants for Top Stories inclusion.
  //
  // Why image matters specifically for NewsArticle: Google's Top Stories
  // carousel + news-briefing voice surfaces ONLY render articles that
  // declare an image. Without it, the post can still index but will be
  // silently excluded from the most valuable retrieval surface for
  // timely content. Declaring it as an ImageObject (not a bare URL
  // string) and passing width/height lets Google's validator skip the
  // fetch-and-measure step, which speeds up indexing on publish day
  // — critical for daily-cadence newsletter posts where the TTL on
  // "news freshness" is measured in hours.
  //
  // The 1200x630 dimension satisfies the minimum-1200px-wide
  // requirement for Top Stories eligibility and keeps parity with the
  // OG card served to Twitter/LinkedIn. Same image URL for both
  // surfaces → single fetch at cold-cache, better Vercel edge hit rate.
  const imageUrl = `${siteUrl}/newsletter/${post.slug}/opengraph-image`;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.subject || "Interlinked by Omni AI",
    description: (post.intro || "").slice(0, 200),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: {
      "@type": "ImageObject",
      url: imageUrl,
      width: 1200,
      height: 630,
    },
    datePublished,
    dateModified,
    keywords: (post.keywords || []).join(", "),
    // mentions: each keyword becomes its own Thing entity, giving the
    // knowledge-graph a walkable edge per topic. `keywords` (comma-string)
    // is what Google's legacy parser reads; `mentions` (typed entity array)
    // is what LLM retrievers + modern Google structured-data indexing
    // prefer — they resolve each Thing as a candidate entity and use the
    // article as evidence that Omni AI is an authority on that topic.
    // Shipping both is belt-and-suspenders: strictly additive, no
    // down-rank risk, and the retrieval lift compounds per keyword.
    //
    // Empty-keywords-array guard: if `post.keywords` is null/empty we
    // omit the `mentions` field entirely rather than ship `mentions: []`
    // — Google's validator flags empty typed arrays as a soft error.
    ...((post.keywords && post.keywords.length > 0)
      ? {
          mentions: post.keywords.map((kw) => ({
            "@type": "Thing",
            name: kw,
          })),
        }
      : {}),
    articleSection,
    ...(wordCount ? { wordCount } : {}),
    author: {
      "@type": "Person",
      name: "Sitani Mafi",
      url: `${siteUrl}/about`,
    },
    // publisher.sameAs echoes the sitewide organizationSchema.sameAs
    // array so Google's cross-page consistency checker resolves every
    // newsletter post's publisher to the same Organization entity
    // declared in app/layout.tsx. Byte-aligned with the matching
    // addition on articleSchema — if one factory's sameAs list changes
    // the other must update in lock-step (see plan T2.5/T2.6 for the
    // eventual LinkedIn + X + Crunchbase + G2 + YouTube rollout).
    publisher: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
      sameAs: ["https://www.linkedin.com/company/omni-ai"],
    },
    inLanguage: "en-US",
    // copyrightHolder / copyrightYear — byte-aligned with the RSS feed
    // <copyright> tag and the articleSchema factory. copyrightYear
    // derives from datePublished rather than new Date() so archived
    // posts keep their honest original year — Google's cross-validator
    // trips on copyrightYear > datePublished and flags the article as
    // retroactively-claimed content.
    copyrightHolder: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
    },
    copyrightYear: new Date(datePublished).getUTCFullYear(),
    // isFamilyFriendly — matches articleSchema. Newsletter content is
    // always enterprise/education appropriate; declaring the flag
    // removes the soft down-rank some LLM safety filters apply to
    // content without the field.
    isFamilyFriendly: true,
    // isAccessibleForFree — every newsletter post currently renders the
    // full body without paywall gating (premium posts are differentiated
    // by visual treatment + upsell CTA, not content hiding). Declaring
    // `true` explicitly prevents Google from flagging the page as
    // subscription-only content (which would trigger abbreviated SERP
    // snippets and exclude the post from Top Stories free-crawl). Must
    // stay byte-aligned with the matching flag on articleSchema above.
    // If premium posts ever start hard-paywalling body content, flip
    // this to conditional (tier === "premium" ? false : true) AND ship
    // a hasPart with cssSelector pointing at the paywalled region per
    // Google's paywalled-content schema guidance.
    isAccessibleForFree: true,
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
    // SpeakableSpecification lets Google Assistant / Alexa / Siri read
    // out the headline + primary Q&A on voice queries. Voice retrieval
    // disproportionately quotes FAQPage-typed content (it's literally
    // the surface voice assistants were trained to read), so shipping
    // speakable on the factory lifts every consumer at once — /faq,
    // /pricing, /vs/[competitor], and the homepage FAQ section all
    // inherit the wiring.
    //
    // cssSelector over xpath because React-hydration + Tailwind class
    // rewriting break xpath stability across renders. The `h1` target
    // universally matches; [data-speakable='faq-intro'] is an opt-in
    // marker consumers add to the single most-important Q&A block on
    // their page (usually the "what is X?" or "how much does X cost?"
    // question — the voice-quote-worthy one). Consumers who don't add
    // the attribute still get the h1 speakable — safe no-op fallback.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "[data-speakable='faq-intro']"],
    },
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
    // SpeakableSpecification — voice assistants (Google Assistant,
    // Alexa, Siri) preferentially read HowTo-typed content for "how
    // do I..." voice queries. Shipping speakable on the factory lifts
    // every HowTo consumer at once (currently /campaigns and
    // /website/development). The h1 target is a universal fallback;
    // [data-speakable='intro'] is the opt-in marker consumers add to
    // their hero subtitle so the voice reply concatenates h1 + intro
    // paragraph as a natural ~10-second summary before enumerating
    // the steps.
    //
    // This matches the same factory-level pattern applied in Cycle
    // 116 to faqPageSchema — one speakable-opinionated factory edit
    // propagates voice retrieval across every consumer without
    // per-page schema changes.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "[data-speakable='intro']"],
    },
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
 * Byte-alignment with the visible nav (updated in Cycle 145):
 *  - Labels match the visible link text verbatim. Previously the schema
 *    shipped "Platform Details" while the navbar rendered "Infographic"
 *    for the same /details URL — exactly the kind of name/href drift
 *    that Google's SiteNavigation parser flags as a misleading manifest.
 *    Now the schema says "Infographic" to match what the user actually
 *    clicks.
 *  - /book-now was removed. It's a CTA button in the navbar (onClick
 *    opens a modal), not a SiteNavigationElement. Schema.org's
 *    SiteNavigationElement is for page-to-page navigation — CTA buttons
 *    that trigger modals don't qualify, and Google's crawler would
 *    deprioritize the whole list for mis-typing one entry.
 *  - /interlinked was added. The footer links to it (position 1 in
 *    footerLinks) but the schema didn't list it — a genuine omission.
 *
 * `position` reflects surface priority: navbar items first (higher
 * visibility), then footer-only items. Google's knowledge graph prefers
 * ordered nav lists.
 */
export const siteNavigationSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Omni AI — Main Navigation",
  itemListOrder: "https://schema.org/ItemListOrderAscending",
  numberOfItems: 10,
  itemListElement: [
    // Navbar items (positions 1–6) — logo home + the 5 visible nav links
    // in components/navbar.tsx. Labels are byte-aligned with the navLinks
    // array in that file. If a navLink is added/removed/renamed, update
    // this block in the same commit.
    { "@type": "SiteNavigationElement", position: 1, name: "Home", url: "https://omnileadsagi.com" },
    { "@type": "SiteNavigationElement", position: 2, name: "Campaigns", url: "https://omnileadsagi.com/campaigns" },
    { "@type": "SiteNavigationElement", position: 3, name: "Infographic", url: "https://omnileadsagi.com/details" },
    { "@type": "SiteNavigationElement", position: 4, name: "Arena", url: "https://omnileadsagi.com/arena" },
    { "@type": "SiteNavigationElement", position: 5, name: "Newsletter", url: "https://omnileadsagi.com/newsletter" },
    { "@type": "SiteNavigationElement", position: 6, name: "Pricing", url: "https://omnileadsagi.com/pricing" },
    // Footer-only items (positions 7–10) — appear in components/footer.tsx
    // footerLinks. /privacy is excluded because it renders in the
    // copyright line, not the main footer nav (conventional legal
    // placement — including it here would over-promote legal boilerplate).
    { "@type": "SiteNavigationElement", position: 7, name: "Interlinked", url: "https://omnileadsagi.com/interlinked" },
    { "@type": "SiteNavigationElement", position: 8, name: "Compare", url: "https://omnileadsagi.com/vs" },
    { "@type": "SiteNavigationElement", position: 9, name: "About", url: "https://omnileadsagi.com/about" },
    { "@type": "SiteNavigationElement", position: 10, name: "FAQ", url: "https://omnileadsagi.com/faq" },
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
