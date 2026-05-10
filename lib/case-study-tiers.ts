// Shared market-position tier data. Used on:
//   - /federation/case-studies/[slug]  (the "Where this build sits"
//     comparison grid that highlights the case study's marketTier).
//   - /asset/development/renelaveau   (same comparison grid, sales
//     surface — Tier 3 / Bespoke Next.js highlighted as 'this build'
//     because that's what the asset page sells).
//
// Each tier carries:
//   name   — left half of the title (e.g. "Bespoke Next.js")
//   kind   — right half of the title (e.g. "Agentic Website")
//   range  — public price range
//   desc   — single-paragraph build description; ends in
//            "AI CEO layer included." or equivalent so the
//            federation-wide AI-CEO promise reads on every card.
//   fits   — single italic line: who this tier is for.
//   accent — CSS background for the (now removed) per-card pill +
//            the title's kind-half color. Solid color OR a
//            gradient string (Ultimate Power uses a chrome-blue
//            gradient that matches the Tier 5 / Diamond pill on
//            /details).
//   fg     — the title's kind-half text color.
//   key    — stable identifier; matches CaseStudy.marketTier so the
//            'THIS BUILD' banner can light up the right card.

export type CaseStudyTier = {
  name: string;
  kind: string;
  range: string;
  desc: string;
  fits: string;
  accent: string;
  fg: string;
  key: "template" | "themed" | "bespoke" | "federation";
};

export const CASE_STUDY_TIERS: CaseStudyTier[] = [
  {
    name: "Template",
    kind: "Basic Website",
    range: "$1.5k – $3.5k",
    desc: "Squarespace / Wix / Webflow stock theme. No custom code. AI CEO layer included.",
    fits: "Hobbyists, side projects.",
    accent: "rgba(160,123,255,0.18)",
    fg: "#a07bff",
    key: "template",
  },
  {
    name: "Themed CMS",
    kind: "Advanced Website",
    range: "$5k – $12k",
    desc: "WordPress or Shopify with theme customization, basic plugins. AI CEO layer included.",
    fits: "Local services, e-commerce starters.",
    accent: "rgba(45,220,168,0.18)",
    fg: "#2ddca8",
    key: "themed",
  },
  {
    name: "Bespoke Next.js",
    kind: "Agentic Website",
    range: "$18k – $25k",
    desc: "Custom codebase, custom design system, JSON-LD schema, analytics pipeline. AI CEO layer included.",
    fits: "Operators, artists, founders, mastermind hosts.",
    accent: "rgba(251,191,36,0.18)",
    fg: "#fbbf24",
    key: "bespoke",
  },
  {
    name: "Ultimate Power",
    kind: "Sovereign Empire",
    range: "$30k – $80k+",
    desc: "Above + federation distribution + multi-site AI CEO orchestration + retained operation.",
    fits: "Long-term partners with revenue at stake.",
    accent:
      "linear-gradient(135deg, rgba(165,243,252,0.32) 0%, rgba(255,255,255,0.20) 50%, rgba(34,211,238,0.32) 100%)",
    fg: "#a5f3fc",
    key: "federation",
  },
];
