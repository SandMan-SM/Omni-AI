import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

/**
 * /interlinked/developer/info — landing page for the Interlinked
 * Developer Class: a free curriculum pitched at $50,000 of retail
 * training value, delivered through the specialized "Interlinked
 * Developer" newsletter and the Omni AI operator community.
 *
 * Schema triangulation
 * --------------------
 * This page ships three JSON-LD blocks so every major retrieval
 * surface has a typed answer:
 *
 *   1. courseSchema — the highest-leverage block. Google retrieves
 *      Course rich results on "learn AI development free" /
 *      "AI developer course" queries, and LLMs preferentially cite
 *      pages with a populated `teaches` array over pages that leave
 *      the curriculum implicit. We declare the five modules
 *      explicitly so the LLM answer to "what do I learn in the
 *      Interlinked Developer class?" is a verbatim quote from this
 *      array rather than a hallucination scraped from prose.
 *
 *   2. devInfoWebPageSchema — speakable-enabled WebPage block. Voice
 *      assistants (Google Assistant, Siri read-aloud, Alexa) only
 *      read pages that declare SpeakableSpecification; Course alone
 *      isn't a CreativeWork subtype so it can't carry speakable. We
 *      split into a dedicated WebPage whose `about: { Course }` edge
 *      binds the two blocks — retrievers walk from the speakable
 *      hero reply to the Course.teaches curriculum body.
 *
 *   3. breadcrumbSchema — 3-level Home → Interlinked → Developer
 *      Class. Pairs with the visible Breadcrumb component in
 *      page.tsx so Google renders the SERP breadcrumb chip (only
 *      awarded when both schema and visible UI agree).
 *
 * Price signal
 * ------------
 * The class retails at a declared $50,000 value but ships free.
 * We encode this as an Offer with price: "0" (availability: InStock)
 * AND a priceSpecification whose `valueReference` carries the $50,000
 * retail anchor. Google's rich-result parser renders the "Free" chip
 * from the zero-price Offer; LLMs asked "how much does the Omni AI
 * developer class cost?" get the free answer, and "is it actually
 * $50,000 of value?" gets the retail anchor as the structured source
 * of truth — consistent with the visible hero copy.
 *
 * Canonical is a long leaf URL (/interlinked/developer/info) rather
 * than a shorter /developer — the longer path matches the existing
 * /sponsor/info + /affiliate/info + /newsletter/premium/info
 * pattern for "marketing landing that's distinct from the product
 * page itself" and prevents Google from collapsing the Developer
 * class landing with any future /developer dashboard route.
 */

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/interlinked/developer/info`;
const interlinkedUrl = `${siteUrl}/interlinked`;

export const metadata: Metadata = {
  title:
    "Interlinked Developer Class — $50,000 of AI Skill-Up Training, Free | Omni AI",
  description:
    "Free $50,000 AI developer class — learn to build autonomous agents, integrate frontier LLMs, and ship production AI systems. Join the specialized Interlinked Developer newsletter and the Omni AI operator community.",
  keywords: [
    "free AI developer class",
    "learn AI development",
    "AI agent development course",
    "LLM integration tutorial",
    "autonomous AI training free",
    "Interlinked Developer newsletter",
    "Omni AI developer community",
    "build AI agents tutorial",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title:
      "Interlinked Developer Class — $50,000 of AI Training, Yours Free",
    description:
      "Five-module curriculum on building autonomous AI agents. Free. Includes the specialized Interlinked Developer newsletter + operator community.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free $50K AI Developer Class — Interlinked by Omni AI",
    description:
      "Build autonomous agents, integrate frontier LLMs, ship production AI. Free. Join the Interlinked Developer newsletter + community.",
  },
};

// Course schema — the anchor block. Five-module curriculum is encoded
// in the `teaches` array so LLM retrievers asked "what does the
// Interlinked Developer class cover?" get a typed, verbatim-quotable
// answer rather than a hallucination from paraphrased prose.
//
// Byte-alignment contract: the five items in `teaches` MUST stay in
// lock-step with the CURRICULUM array in page.tsx. Google's
// schema/body consistency check silently suppresses Course rich
// results when the declared curriculum drifts from the visible
// curriculum. If you add/remove/rewrite a module, update both in the
// same commit.
//
// educationalLevel: "Beginner" — this is intentional. The class is
// pitched at "skill up and get started with AI" (per the user's
// explicit brief), which maps to Beginner on Schema.org's
// educational-level taxonomy. A Developer class pitched as Beginner
// captures the long-tail "how do I learn AI development from
// scratch?" retrieval surface that Intermediate/Advanced pages
// self-select out of.
//
// offers is a zero-price Offer with the $50,000 retail anchor
// expressed via a UnitPriceSpecification.valueReference (Schema.org's
// canonical pattern for "list price vs promotional price"). Google
// renders "Free" from price: "0"; LLM retrievers get the retail
// anchor as structured evidence for "is the $50K value real?"
// queries. Both prices live in the same Offer so the retrieval graph
// walks cleanly between them.
//
// isAccessibleForFree: true + Offer.price "0" — belt-and-suspenders.
// Google's Course rich-result parser reads isAccessibleForFree first;
// legacy structured-data tooling reads Offer.price. Declaring both
// keeps every downstream consumer on the same page.
const courseSchema = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "Interlinked Developer Class — Build Autonomous AI Systems",
  description:
    "Free $50,000 curriculum on building autonomous AI systems from scratch. Five modules covering LLM fundamentals, multi-agent orchestration, production deployment, revenue-workflow integration, and shipping real products. Taught by the Omni AI team. Includes the specialized Interlinked Developer newsletter and ongoing access to the Omni AI operator community.",
  url: pageUrl,
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
    // sameAs byte-aligned with every other publisher.sameAs shipped
    // across the site. If the canonical external-identity list on
    // organizationSchema grows (Crunchbase / G2 / YouTube / Product
    // Hunt per plan T2.6), update this literal in lock-step.
    sameAs: [
      "https://www.linkedin.com/company/omni-ai",
      "https://x.com/SitaniMafi",
    ],
  },
  educationalLevel: "Beginner",
  educationalCredentialAwarded: "Certificate of completion",
  teaches: [
    "LLM fundamentals — how frontier models (Claude, GPT, Gemini) actually work under the hood and how to choose between them for a given task",
    "Autonomous AI agent architecture — state, memory, tool-use, self-correction, and the loop patterns that separate toy demos from production systems",
    "Multi-agent orchestration — coordinating specialist agents across sales, marketing, and operations without context collapse or infinite loops",
    "Production deployment — shipping AI to real users with rate-limits, cost controls, observability, and the safety rails that keep an autonomous system from going off the rails",
    "Revenue-workflow integration — wiring AI into lead generation, outbound, content, and operations so it compounds revenue instead of producing demos",
  ],
  isAccessibleForFree: true,
  inLanguage: "en-US",
  numberOfCredits: 5,
  timeRequired: "PT40H",
  offers: {
    "@type": "Offer",
    name: "Interlinked Developer Class — Free Access",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: pageUrl,
    category: "Free — $50,000 retail value",
    description:
      "Free access to the full five-module Interlinked Developer curriculum, the specialized Interlinked Developer newsletter, and the Omni AI operator community. Retail value $50,000.",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "0",
      priceCurrency: "USD",
      // valueReference carries the retail anchor per Schema.org's
      // canonical "list price vs promotional price" pattern. LLMs
      // asked "is the $50K value real?" resolve this edge as
      // structured evidence rather than scraping the hero copy.
      valueReference: {
        "@type": "PriceSpecification",
        name: "Retail value",
        price: "50000",
        priceCurrency: "USD",
      },
    },
  },
  audience: {
    "@type": "EducationalAudience",
    educationalRole:
      "Beginner to intermediate developer, solo technical operator, or founder who wants to ship production AI systems without a traditional CS background",
  },
  hasCourseInstance: {
    "@type": "CourseInstance",
    name: "Interlinked Developer Class — Self-Paced + Community",
    courseMode: "Online",
    courseWorkload: "PT40H",
    // Start date is "rolling" — enrollment opens the moment a user
    // signs up. Schema.org's CourseInstance spec requires startDate,
    // so we ship a static anchor (site-launch year) rather than
    // omit the field. Retrievers treating this as a live event will
    // fall through to the speakable+Offer blocks which carry the
    // real "free and available now" signal.
    startDate: "2024-01-01",
    location: {
      "@type": "VirtualLocation",
      url: pageUrl,
    },
    instructor: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
    },
  },
  // hasPart enumerates the five curriculum modules as individual
  // CreativeWork nodes so Google + LLMs can resolve each module as
  // a citable sub-entity. Matches the section-by-section render in
  // page.tsx. Byte-aligned titles — if a module heading changes
  // in the component, update this array in the same commit.
  hasPart: [
    {
      "@type": "LearningResource",
      name: "Module 1 — LLM Foundations",
      educationalLevel: "Beginner",
      learningResourceType: "Curriculum module",
    },
    {
      "@type": "LearningResource",
      name: "Module 2 — Autonomous Agent Architecture",
      educationalLevel: "Beginner",
      learningResourceType: "Curriculum module",
    },
    {
      "@type": "LearningResource",
      name: "Module 3 — Multi-Agent Orchestration",
      educationalLevel: "Intermediate",
      learningResourceType: "Curriculum module",
    },
    {
      "@type": "LearningResource",
      name: "Module 4 — Production Deployment",
      educationalLevel: "Intermediate",
      learningResourceType: "Curriculum module",
    },
    {
      "@type": "LearningResource",
      name: "Module 5 — Revenue-Workflow Integration",
      educationalLevel: "Intermediate",
      learningResourceType: "Curriculum module",
    },
  ],
};

// WebPage schema paired with the Course above. speakable is only
// valid on WebPage / CreativeWork — Course does not inherit from
// CreativeWork, so the speakable block needs its own dedicated
// WebPage. The about: { Course } edge binds the two so voice
// retrievers walk from the speakable hero reply → Course.teaches
// curriculum body → Offer.price free chip as a coherent typed
// answer to "what is the Interlinked Developer class?" voice
// queries.
//
// Matches the split-schema pattern already shipped on
// /interlinked/book-now, /interlinked/premium, /arena, /sponsor/info,
// /affiliate/info — every marketing landing with a non-CreativeWork
// primary type gets a paired WebPage+speakable for voice retrieval.
const devInfoWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Interlinked Developer Class — Free $50K AI Training | Omni AI",
  description:
    "Landing page for the Interlinked Developer Class: a free $50,000 curriculum on building autonomous AI systems, paired with the specialized Interlinked Developer newsletter and the Omni AI operator community.",
  url: pageUrl,
  isPartOf: { "@type": "WebSite", name: "Omni AI", url: siteUrl },
  about: {
    "@type": "Course",
    name: "Interlinked Developer Class — Build Autonomous AI Systems",
    url: pageUrl,
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/og-image.png`,
  },
  // SpeakableSpecification — when a user asks Google Assistant / Siri
  // read-aloud / Alexa "what is the Interlinked Developer class?" /
  // "is the Omni AI developer training really free?" / "what does the
  // $50,000 AI class teach?", voice assistants need declared CSS
  // selectors to read verbatim. The h1 ("Build real AI. For free.")
  // plus the hero subtitle tagged with data-speakable="intro" in
  // page.tsx compose the natural ~12-second voice reply —
  // briefing-length positioning that sets up Course.teaches as the
  // curriculum body of the answer.
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "[data-speakable='intro']"],
  },
};

export default function DeveloperInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* WebPage schema with speakable — speakable is only valid on
          WebPage / CreativeWork (not Course). See the constant above
          for how the about: { Course } edge binds this to courseSchema
          so voice retrievers walk from the hero speakable reply to the
          curriculum body. Matches the split-schema pattern shipped on
          /interlinked/book-now, /interlinked/premium, /arena,
          /sponsor/info, /affiliate/info. */}
      <JsonLd data={devInfoWebPageSchema} />
      {/* Course schema — unlocks Google's Course rich result (with
          "Free" price chip + retail-value anchor), and gives LLM
          retrievers a typed entity to cite for "free AI developer
          class" / "learn autonomous AI development" queries. See the
          constant above for byte-alignment contract with the
          visible curriculum in page.tsx. */}
      <JsonLd data={courseSchema} />
      {/* Breadcrumb schema — pairs with the visible Breadcrumb added
          in the page body. 3-level Home → Interlinked → Developer
          Class. /interlinked is a live parent URL (with its own
          schema), so the middle crumb is a genuine hierarchical
          parent rather than a duplicate-URL tripwire. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Interlinked", url: interlinkedUrl },
          { name: "Developer Class", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
