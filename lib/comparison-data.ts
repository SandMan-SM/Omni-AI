/**
 * Comparison data for /vs/[competitor] programmatic pages.
 *
 * One entry per direct competitor surfaced in homepage SEO copy, the FAQ,
 * and the llms.txt. These pages target head-of-commercial-intent queries
 * like "HubSpot alternative", "Apollo vs Omni AI", "Clay replacement" —
 * the exact phrases an operator types after they've outgrown the tool
 * they're currently on.
 *
 * The content is intentionally honest about when to KEEP the competitor
 * (not just bash-and-sell). Operators smell sales copy; LLMs retrieve
 * balanced takes more often than one-sided rants. The `pros` list is
 * what the competitor actually does well; `cons` is where Omni AI is the
 * better fit.
 */
export interface ComparisonData {
  slug: string;
  name: string;
  category: string;
  pricing: string;
  summary: string;
  positioning: string;
  keyDifference: string;
  table: { category: string; them: string; us: string }[];
  pros: string[];
  cons: string[];
  faqs: { question: string; answer: string }[];
  integrationNote: string;
}

export const COMPARISONS: Record<string, ComparisonData> = {
  hubspot: {
    slug: "hubspot",
    name: "HubSpot",
    category: "CRM + Marketing Hub",
    pricing: "Free tier up to $3,600/mo Marketing Hub Enterprise",
    summary:
      "HubSpot is a mature CRM with a marketing automation hub bolted on. Omni AI is an autonomous lead-generation platform that ships outbound, creative, and campaigns without human intervention.",
    positioning:
      "HubSpot records activity after it happens — a human or a connected tool has to trigger each action. Omni AI is the layer that decides and ships the next action on its own, then logs the outcome so the system compounds over time.",
    keyDifference:
      "HubSpot is where your pipeline lives. Omni AI is the operator that fills it. Teams running at scale usually keep both — HubSpot as the source-of-truth CRM, Omni AI as the autonomous outbound + creative + ops layer feeding it.",
    table: [
      {
        category: "Primary function",
        them: "CRM that records lead + deal activity",
        us: "Autonomous system that sources leads + ships campaigns",
      },
      {
        category: "Outbound execution",
        them: "Requires sequences built + triggered by a human",
        us: "Decides what to send, produces creative, ships without triggers",
      },
      {
        category: "Creative production",
        them: "None — you write, design, and record everything",
        us: "AI writes copy, produces video, designs landing pages",
      },
      {
        category: "Learning loop",
        them: "Reporting dashboards — interpretation is manual",
        us: "Auto-promotes winning agents, retires losers without ops input",
      },
      {
        category: "Pricing model",
        them: "Seat-based + contact-tier pricing scales painfully",
        us: "Flat tiers; autonomous execution doesn't cost per-seat",
      },
    ],
    pros: [
      "Best-in-class contact + deal record-keeping",
      "Huge ecosystem of native integrations (3,000+ apps)",
      "Strong reporting and marketing attribution dashboards",
      "Mature support, onboarding, and training resources",
    ],
    cons: [
      "Requires a human (or another tool) to trigger every sequence",
      "No autonomous creative — you still write, design, and record",
      "Contact-tier pricing punishes list growth",
      "Workflow builder gets complex fast; ops cost compounds",
    ],
    faqs: [
      {
        question: "Does Omni AI replace HubSpot?",
        answer:
          "For most operators under $5M ARR, yes — Omni AI's free tier covers contact sourcing, sequencing, creative production, and qualification in one system. Above $5M ARR, most teams keep HubSpot as the CRM of record and plug Omni AI in as the autonomous outbound + creative layer feeding it.",
      },
      {
        question: "Does Omni AI integrate with HubSpot?",
        answer:
          "Yes. Omni AI is API-first and pushes qualified leads, activity events, and campaign outcomes into HubSpot contacts and deals. If your stack speaks REST or webhooks, the integration is a one-time config — not a custom build.",
      },
      {
        question: "Is Omni AI cheaper than HubSpot?",
        answer:
          "For most operators, materially cheaper. HubSpot's contact-tier pricing means list growth drives cost up independent of revenue; Omni AI's tiers are flat and the free tier includes autonomous campaign generation. See the tier map at omnileadsagi.com/book-now.",
      },
      {
        question: "Can I keep HubSpot and run Omni AI on top?",
        answer:
          "That's the most common pattern for teams at $5M+ ARR. HubSpot stays as the CRM and attribution engine; Omni AI handles the sourcing, creative, and outbound layer that would otherwise need an SDR team, a video editor, and a marketing ops hire to coordinate.",
      },
    ],
    integrationNote:
      "Omni AI pushes qualified leads, campaign activity, and meeting-booked events directly into HubSpot deals via the HubSpot API v3.",
  },
  apollo: {
    slug: "apollo",
    name: "Apollo",
    category: "Contact database + basic sequencing",
    pricing: "$49–$499 per user per month (seat-based)",
    summary:
      "Apollo is a B2B contact database with basic email sequencing bolted on. Omni AI is an autonomous lead-generation system that sources, writes, produces, and ships — without per-seat pricing.",
    positioning:
      "Apollo is great at 'here are the contacts, now you write the sequence.' Omni AI closes the gap between having contact data and shipping creative outbound — the part where most Apollo users stall because they don't have an SDR team to write copy every week.",
    keyDifference:
      "Apollo gives you the fuel. Omni AI is the engine, the driver, and the route optimizer. If your team is one or two people who bought Apollo hoping it would 'just work' — Omni AI is what you actually wanted.",
    table: [
      {
        category: "Primary function",
        them: "B2B contact data + template-based email sequences",
        us: "Autonomous sourcing + creative production + execution",
      },
      {
        category: "Creative production",
        them: "None — you write every template",
        us: "AI writes per-contact copy, generates video variants, tests + iterates",
      },
      {
        category: "Pricing model",
        them: "Seat-based: $49–$499 per user per month",
        us: "Flat platform tier; no per-seat tax",
      },
      {
        category: "Channel coverage",
        them: "Email + LinkedIn (manual connection)",
        us: "Email, LinkedIn, video, landing pages, retargeting ads",
      },
      {
        category: "Learning loop",
        them: "A/B test two subject lines manually",
        us: "Auto-rotates creative + channel mix based on reply + meeting rate",
      },
    ],
    pros: [
      "Large, reasonably fresh B2B contact database",
      "Fast to get started with basic outbound sequences",
      "Strong Chrome extension for prospecting on LinkedIn",
      "Affordable entry tier for solo outbound operators",
    ],
    cons: [
      "Templates only — no autonomous creative or video",
      "Seat-based pricing becomes expensive as team grows",
      "Sequence performance depends entirely on your copywriting",
      "Data quality varies by industry; manual verification still needed",
    ],
    faqs: [
      {
        question: "Is Omni AI an Apollo alternative?",
        answer:
          "Yes — Omni AI covers everything Apollo does (contact sourcing, email sequencing) plus creative production, video generation, landing pages, and autonomous optimization. Most Apollo users who switch cite the seat-based pricing and the manual copywriting load as the reasons they moved.",
      },
      {
        question: "Does Omni AI include contact data like Apollo?",
        answer:
          "Yes. Omni AI sources contacts via verified B2B databases, public enrichment APIs, and integrations with LinkedIn, Clearbit, and similar tools. The system decides where to pull from based on the campaign target, so you don't manage separate data subscriptions.",
      },
      {
        question: "How does Omni AI's pricing compare to Apollo?",
        answer:
          "Apollo charges per seat ($49–$499/user/mo) so a team of 5 on the Organization tier runs $2,495/month. Omni AI uses flat platform pricing — the free tier includes autonomous campaign generation, and paid tiers don't multiply by headcount. Book a call at omnileadsagi.com/book-now for a direct tier-by-tier map.",
      },
      {
        question: "Can I keep Apollo and run Omni AI too?",
        answer:
          "Yes. Some operators keep Apollo's Chrome extension for manual prospecting and let Omni AI handle the rest of the outbound + creative loop. The two don't conflict — Omni AI can read contacts from an Apollo list export or source independently.",
      },
    ],
    integrationNote:
      "Omni AI can import Apollo lists directly, or replace the sourcing layer entirely — most teams pick one approach after the first 30 days.",
  },
  clay: {
    slug: "clay",
    name: "Clay",
    category: "Enrichment workflow builder",
    pricing: "$149–$2,000+ per month",
    summary:
      "Clay is a powerful enrichment workflow builder for data-ops teams. Omni AI is the execution layer above it — handling the part where you actually have to use the enriched data to ship outbound, creative, and campaigns.",
    positioning:
      "Clay is the best tool in the category for teams who want to build custom waterfall enrichment flows. Omni AI is for teams who want the output of those flows — qualified leads landing in your calendar — without building the flows yourself.",
    keyDifference:
      "Clay is a data workflow tool. Omni AI is a revenue system. Clay answers 'how do I enrich these 10,000 contacts?'. Omni AI answers 'how do I get 100 of those 10,000 to book a call this quarter?'.",
    table: [
      {
        category: "Primary function",
        them: "Custom enrichment + data workflow builder",
        us: "End-to-end revenue system (source → creative → execute → qualify)",
      },
      {
        category: "Learning curve",
        them: "High — needs an ops-engineer mindset to use effectively",
        us: "Low — free tier starts generating campaigns on sign-up",
      },
      {
        category: "Creative + execution",
        them: "None — you export the enriched data elsewhere",
        us: "AI writes copy, ships email + video + ads, books meetings",
      },
      {
        category: "Time to first result",
        them: "Days to weeks (build + test the workflow)",
        us: "Minutes (free tier) to hours (first paid campaign live)",
      },
      {
        category: "Best fit",
        them: "Data-ops teams at Series B+ with specific workflow needs",
        us: "Solo operators + lean RevOps teams who want output, not workflows",
      },
    ],
    pros: [
      "Most flexible data enrichment builder on the market",
      "Waterfall enrichment logic is industry-leading",
      "Strong integrations with B2B data vendors",
      "Active community sharing workflow templates",
    ],
    cons: [
      "Steep learning curve — most users need a dedicated ops resource",
      "Only enriches — doesn't write copy, produce creative, or execute",
      "Cost scales with enrichment volume and credit usage",
      "You still need a separate tool (or team) to ship outbound",
    ],
    faqs: [
      {
        question: "Is Omni AI a Clay replacement?",
        answer:
          "For most operators, yes — Omni AI handles enrichment as part of the campaign pipeline so you don't manage a separate workflow tool. If your team has a dedicated ops engineer who loves Clay's waterfall builder, keep Clay. If you want the output (qualified leads) without building the workflow, Omni AI is the more direct path.",
      },
      {
        question: "Does Omni AI do enrichment like Clay?",
        answer:
          "Yes. Omni AI enriches contacts automatically using the same underlying data vendors Clay uses, plus public APIs and first-party signals. The difference is you don't build the waterfall — the system picks the enrichment path based on what the campaign needs.",
      },
      {
        question: "Which is easier to learn: Clay or Omni AI?",
        answer:
          "Omni AI is materially easier. Clay rewards ops-engineer thinking — most teams need someone fluent in data transformations to unlock its power. Omni AI's free tier starts generating campaigns on sign-up and the learning curve is 'describe your ICP' rather than 'design a waterfall.'",
      },
      {
        question: "Can I use Clay and Omni AI together?",
        answer:
          "Yes. Some teams keep Clay for one-off enrichment projects (e.g., building a custom account list) and run Omni AI for ongoing outbound + creative. The two don't conflict — you can pipe a Clay output into an Omni AI campaign as the target list.",
      },
    ],
    integrationNote:
      "Omni AI accepts Clay exports as a target list input, or replaces the enrichment layer entirely — pick based on whether ops engineering is a fit for your team.",
  },
};

export const COMPARISON_SLUGS = Object.keys(COMPARISONS);
