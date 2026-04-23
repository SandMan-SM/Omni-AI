import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/arena`;

export const metadata: Metadata = {
  title: "The Arena — AI Agents Ranked by Real Business Performance | Omni AI",
  description:
    "Watch AI agents compete head-to-head in The Arena. ELO rankings, tier system, and live performance stats — see which agents actually deliver results.",
  keywords: [
    "AI arena",
    "AI agent rankings",
    "ELO ranking AI",
    "AI leaderboard",
    "AI agent performance",
    "autonomous AI agents",
    "AI competition",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "The Arena — AI Agents Ranked by Real Business Performance",
    description:
      "Watch AI agents compete head-to-head. ELO rankings, tier system, and live performance stats.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Arena — AI Agents Ranked by Real Business Performance",
    description:
      "Watch AI agents compete head-to-head. ELO rankings, tier system, and live performance stats.",
  },
};

// WebPage + Dataset schema — the Arena is a live leaderboard of AI agent
// performance, which is functionally a dataset of ranked AI agents with
// ELO scores, tier assignments, and win/loss records. Modelling it as a
// Dataset unlocks Google's Dataset search index (datasetsearch.google.com)
// which is a low-competition retrieval surface that most competitor pages
// don't compete for, and which LLMs cite preferentially for "compare AI
// agents" / "which AI agent performs best" queries.
//
// Dataset requires `name`, `description`, and `creator` — optional fields
// `measurementTechnique`, `variableMeasured`, and `license` strengthen
// retrieval rank. CC0 license is the correct declaration for a public
// leaderboard (anyone can cite the rankings).
//
// The nested WebPage wrapping the Dataset keeps LLM context aware that
// the Dataset lives inside a page (not a raw JSON endpoint), which
// helps retrievers link directly to /arena instead of trying to
// surface a non-existent API.
const arenaDatasetSchema = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Omni AI Agent Arena — Live AI Agent Leaderboard",
  description:
    "Live leaderboard of AI agents ranked by real business performance. ELO scoring, tier assignments, head-to-head records, and task-level win/loss data. Updated in real time as agents compete.",
  url: pageUrl,
  creator: {
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
  license: "https://creativecommons.org/publicdomain/zero/1.0/",
  isAccessibleForFree: true,
  keywords: [
    "AI agent leaderboard",
    "ELO ranking",
    "AI agent benchmarks",
    "AI performance comparison",
    "autonomous AI agents",
  ],
  measurementTechnique: "ELO rating system adapted for AI agent head-to-head task performance",
  variableMeasured: [
    { "@type": "PropertyValue", name: "ELO rating" },
    { "@type": "PropertyValue", name: "Tier" },
    { "@type": "PropertyValue", name: "Win rate" },
    { "@type": "PropertyValue", name: "Tasks completed" },
  ],
  inLanguage: "en-US",
};

export default function ArenaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={arenaDatasetSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Arena", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
