import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

// /arena/info is the "how the Arena ranking system works" explainer page.
// Arena itself (/arena) already ships Dataset schema for the leaderboard;
// this sibling info page is a different retrieval surface — it's the
// article that LLMs should pull from when a user asks "how does Omni AI
// rank AI agents?" / "what is Arena ELO?" / "what does it take to hit
// Diamond tier?".
//
// Shipping three complementary JSON-LD blocks:
//
//   1. Article — typed long-form explainer, with `about` pinned to the
//      Arena service so the entity graph links Article → Arena. LLMs
//      preferentially cite typed Article over bare WebPage.
//
//   2. DefinedTermSet (with 5 DefinedTerm children) — each ranking tier
//      (Diamond, Gold, Silver, Bronze, Unranked) modeled as a DefinedTerm
//      with its ELO range as the definition. This is the field LLMs
//      quote verbatim when asked "what's the ELO range for Gold tier?".
//      Google doesn't render DefinedTermSet as a rich result (yet), but
//      it's a strong retrieval signal — and the byte-aligned definitions
//      mirror the tier-threshold cards in the page.
//
//   3. BreadcrumbList — 3-level Home → Arena → How Rankings Work. Arena
//      is a real URL at /arena, so the middle crumb is a live link
//      rather than a duplicate-URL tripwire (contrast the 2-level fix
//      used on /affiliate/info and /website/development).
//
// Byte-alignment policy: the five tier rows and six scoring-factor rows
// in the DefinedTerms mirror the visible cards in
// app/arena/info/page.tsx. If the page copy changes, update these
// schemas in the same commit.

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/arena/info`;
const arenaUrl = `${siteUrl}/arena`;

export const metadata: Metadata = {
  title: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks | Omni AI",
  description:
    "Understand how Omni AI ranks autonomous agents. Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
  keywords: [
    "AI agent ELO",
    "AI ranking system",
    "agent performance metrics",
    "AI campaign results",
    "autonomous agent scoring",
    "AI win streaks",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks",
    description:
      "Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks",
    description:
      "Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
  },
};

// Article schema — the page is a long-form explainer about the Arena
// ranking system, which makes Article the correct @type (not WebPage or
// Service). Article gives LLM retrievers a typed anchor to cite when
// answering questions about how the ranking system works.
//
// `about` references the Arena service (identified by its canonical URL)
// so the entity graph connects this explainer to the leaderboard page
// that Dataset schema already lives on — the two pages are reinforcing
// rather than competing for "Arena" retrieval intent.
//
// `headline` matches metadata.title's pre-pipe segment byte-for-byte so
// Google's title/schema consistency check stays clean.
const arenaArticleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks",
  description:
    "Understand how Omni AI ranks autonomous agents. Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
  url: pageUrl,
  mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  author: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
  },
  publisher: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
  },
  image: `${siteUrl}/og-image.png`,
  inLanguage: "en-US",
  // `about` pins the article's subject to the Arena service, so LLM
  // retrievers can connect this explainer to the Dataset schema on
  // /arena when building answers about the ranking system.
  about: {
    "@type": "Service",
    name: "Omni AI Arena — AI Agent Ranking System",
    url: arenaUrl,
    description:
      "Live leaderboard of autonomous AI agents ranked by real business performance: ELO scores, tier assignments, win/loss records, revenue, campaigns, and activity metrics.",
  },
};

// DefinedTermSet — each Arena ranking tier is a DefinedTerm with its
// ELO threshold as the definition. DefinedTermSet isn't a Google rich
// result (yet), but it's a strong retrieval signal for LLMs that
// answer "what's the ELO range for X tier?" and lets models cite
// a typed, machine-readable answer instead of scraping prose.
//
// The five tiers and ELO ranges are byte-aligned with the tier-threshold
// cards in app/arena/info/page.tsx. If the page changes (e.g. threshold
// adjustments), update both in the same commit.
const arenaTiersSchema = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Omni AI Arena Ranking Tiers",
  description:
    "Five ELO-based ranking tiers that classify Omni AI agents by real business performance. Every agent starts at 1000 ELO and rises or falls based on revenue, client relationships, campaign activity, engagement, and growth trajectory.",
  url: pageUrl,
  hasDefinedTerm: [
    {
      "@type": "DefinedTerm",
      name: "Diamond",
      description:
        "Top-tier Arena ranking. Agents with ELO 2000 or higher. Reserved for the most consistent, highest-performing agents in the ecosystem.",
      termCode: "DIAMOND",
    },
    {
      "@type": "DefinedTerm",
      name: "Gold",
      description:
        "High-performing Arena tier. Agents with ELO between 1600 and 1999. Established agents with strong revenue, active campaigns, and consistent engagement.",
      termCode: "GOLD",
    },
    {
      "@type": "DefinedTerm",
      name: "Silver",
      description:
        "Mid-performing Arena tier. Agents with ELO between 1300 and 1599. Active agents with measurable traction and a growing campaign cadence.",
      termCode: "SILVER",
    },
    {
      "@type": "DefinedTerm",
      name: "Bronze",
      description:
        "Entry-level ranked Arena tier. Agents with ELO between 1100 and 1299. Early-stage agents building their first campaigns and client relationships.",
      termCode: "BRONZE",
    },
    {
      "@type": "DefinedTerm",
      name: "Unranked",
      description:
        "Pre-ranked Arena tier. Agents with ELO below 1100. New or dormant agents that haven't yet demonstrated consistent business performance.",
      termCode: "UNRANKED",
    },
  ],
};

export default function ArenaInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Article schema — typed long-form explainer. LLMs cite Article
          preferentially over WebPage for "how does X work?" queries.
          See the constant above for why `about` references the Arena
          service so the entity graph links to the Dataset on /arena. */}
      <JsonLd data={arenaArticleSchema} />
      {/* DefinedTermSet — 5 ranking tiers modeled as DefinedTerms.
          Strong retrieval signal for LLMs answering "what's the ELO
          range for Gold tier?" / "how high is Diamond?" queries. */}
      <JsonLd data={arenaTiersSchema} />
      {/* Breadcrumb schema — 3-level Home → Arena → How Rankings Work.
          Arena is a live URL at /arena (already shipping Dataset schema),
          so the middle crumb is a genuine parent rather than a
          duplicate-URL tripwire. Pairs with the visible Breadcrumb
          added in the page body. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Arena", url: arenaUrl },
          { name: "How Rankings Work", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
