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
  salesforce: {
    slug: "salesforce",
    name: "Salesforce",
    category: "Enterprise CRM",
    pricing: "$25–$500+ per user per month (Sales Cloud → Unlimited)",
    summary:
      "Salesforce is the enterprise CRM standard — deeply customizable, backed by a massive partner ecosystem. Omni AI is the autonomous execution layer above it that ships outbound, creative, and campaigns without needing a Salesforce admin to orchestrate each step.",
    positioning:
      "Salesforce excels as the record-of-truth once a deal is in motion. Omni AI excels at the stage before — finding, engaging, and qualifying prospects so they show up in your Salesforce pipeline already warm. The two are complementary, not competing.",
    keyDifference:
      "Salesforce is customizable infrastructure — powerful if you have a dedicated admin or SI partner running it. Omni AI is opinionated execution — it makes the autonomous calls a human operator would, without requiring the configuration tax.",
    table: [
      {
        category: "Primary function",
        them: "Enterprise CRM of record + custom workflow engine",
        us: "Autonomous system that fills the pipeline before it hits the CRM",
      },
      {
        category: "Admin burden",
        them: "Typically requires a dedicated admin or certified partner",
        us: "Zero config — free tier ships useful campaigns on sign-up",
      },
      {
        category: "Creative + outbound",
        them: "None — depends on Marketing Cloud or third-party tools",
        us: "AI writes copy, produces video, ships multi-channel outbound",
      },
      {
        category: "Pricing model",
        them: "Per-seat, per-tier — can exceed $500/user/month",
        us: "Flat platform tiers; free tier available",
      },
      {
        category: "Time to value",
        them: "Weeks to months (implementation + admin setup)",
        us: "Minutes on the free tier; hours on paid tiers",
      },
    ],
    pros: [
      "Most mature CRM feature set in the market",
      "Deep customization via Flow, Apex, and the AppExchange ecosystem",
      "Gold-standard reporting and forecasting capabilities",
      "Widely adopted — Salesforce skills are easy to hire for",
    ],
    cons: [
      "Requires admin expertise to run effectively — hidden ops cost",
      "No native autonomous outbound — still need sequencing/creative tools",
      "Per-user pricing scales into six figures fast for mid-market teams",
      "Implementation timelines measured in quarters, not weeks",
    ],
    faqs: [
      {
        question: "Is Omni AI a Salesforce replacement?",
        answer:
          "For most teams, no — Salesforce stays as the CRM of record and Omni AI feeds it warmer pipeline. A few smaller operations replace Salesforce with a lighter CRM (HubSpot free tier, Pipedrive) when Omni AI handles the top-of-funnel work that used to justify a Salesforce admin.",
      },
      {
        question: "Does Omni AI integrate with Salesforce?",
        answer:
          "Yes. Omni AI pushes qualified leads, campaign events, and meeting-booked signals into Salesforce leads, contacts, and opportunities via the Salesforce REST API. Two-way sync is supported — updates in Salesforce reflect back into Omni AI campaign context.",
      },
      {
        question: "How does Omni AI compare to Salesforce Marketing Cloud or Einstein?",
        answer:
          "Salesforce's marketing + Einstein AI products layer on top of Salesforce data. Omni AI works independently — it doesn't require a Salesforce admin to configure prompts or data connectors. For teams already paying for Marketing Cloud, Omni AI usually replaces the execution part of the stack while keeping the CRM record-keeping layer.",
      },
      {
        question: "Can a small team run Omni AI without Salesforce?",
        answer:
          "Yes. Many operators under $5M ARR use Omni AI as their full revenue stack without a CRM at all, letting Omni AI track pipeline state natively. Add a lightweight CRM when you grow past the point where spreadsheet-grade pipeline becomes painful.",
      },
    ],
    integrationNote:
      "Omni AI syncs qualified leads and meeting-booked events into Salesforce via the REST API — two-way so CRM updates flow back into Omni AI context.",
  },
  outreach: {
    slug: "outreach",
    name: "Outreach",
    category: "Sales engagement platform",
    pricing: "$100–$200+ per user per month (custom quotes above)",
    summary:
      "Outreach is the category-leading sales engagement platform built for SDR teams running template-based sequences. Omni AI is for operators who want autonomous outbound — no SDR team, no seat costs, no template engineering.",
    positioning:
      "Outreach assumes you have SDRs executing sequences and a team lead tuning the templates. Omni AI assumes you don't — the system writes the outbound, tests variants, and promotes winners on its own, so the SDR-team layer isn't required to get results.",
    keyDifference:
      "Outreach is a force multiplier for SDR teams. Omni AI is a replacement for the SDR team entirely, for operators under $5M ARR who can't justify the headcount in the first place.",
    table: [
      {
        category: "Team model",
        them: "Built for SDR teams running coordinated sequences",
        us: "Built for solo + lean teams running autonomous sequences",
      },
      {
        category: "Creative production",
        them: "None — template library + human writers",
        us: "AI writes per-contact copy, generates video, tests variants",
      },
      {
        category: "Pricing model",
        them: "Per-seat enterprise pricing; $100–$200/user/mo typical",
        us: "Flat platform tiers; no per-seat multiplier",
      },
      {
        category: "Learning loop",
        them: "Analytics dashboards — humans interpret and adjust",
        us: "Auto-promotes winning variants, retires losers without ops input",
      },
      {
        category: "Best fit",
        them: "Series B+ SaaS with 10+ SDRs",
        us: "Solo founders through Series A SaaS (1–5 RevOps seats)",
      },
    ],
    pros: [
      "Mature sequencing + cadence engine built for SDR teams",
      "Strong Salesforce native integration",
      "Battle-tested analytics and forecasting dashboards",
      "Established training + enablement resources",
    ],
    cons: [
      "No autonomous creative — template engineering is a constant job",
      "Per-seat pricing assumes you already have an SDR team",
      "Manual variant testing — no auto-promotion of winners",
      "Minimum seat counts and enterprise contracts common",
    ],
    faqs: [
      {
        question: "Is Omni AI an Outreach alternative?",
        answer:
          "For teams without an existing SDR team, Omni AI is the better fit — it's designed to run outbound autonomously rather than coordinate sequences across human sellers. For teams with 10+ SDRs who want a sequencing engine, Outreach is still the category leader.",
      },
      {
        question: "Can I replace Outreach with Omni AI?",
        answer:
          "Most operations under $5M ARR can — Omni AI covers sequencing, creative production, video outreach, and qualification in one system without seat costs. Above that, teams often keep Outreach for their existing SDR organization and use Omni AI on top-of-funnel prospecting that would otherwise need more SDR hiring.",
      },
      {
        question: "How does Omni AI's pricing compare to Outreach?",
        answer:
          "Outreach typically runs $100–$200 per seat per month and often requires minimum seat counts. Omni AI uses flat platform tiers with no per-seat charge — so a solo operator on the free tier pays $0 while a 10-seat Outreach deployment runs $12,000–$24,000 per year. Book a call at omnileadsagi.com/book-now for a direct mapping.",
      },
      {
        question: "Does Omni AI do video outreach like Outreach with Vidyard?",
        answer:
          "Yes — Omni AI generates personalized video variants natively via its video pipeline. No third-party Vidyard plug-in needed. Variants are auto-tested and the winning format gets promoted across the campaign without manual intervention.",
      },
    ],
    integrationNote:
      "Omni AI can import Outreach sequences as a starting point or replace the sequencing layer entirely — most teams migrate fully within 60 days once autopilot is trusted.",
  },
  lemlist: {
    slug: "lemlist",
    name: "Lemlist",
    category: "Cold email + personalized video",
    pricing: "$39–$199 per user per month",
    summary:
      "Lemlist is a cold email tool with built-in personalized video and landing pages — a go-to for solo SDRs and small outbound teams. Omni AI covers everything Lemlist does plus autonomous creative production, multi-channel orchestration, and self-optimizing campaigns.",
    positioning:
      "Lemlist is a great tool if you already know what to write and just need a fast way to ship it. Omni AI is a better fit if you want the system to decide what to write, produce the video, ship it, measure it, and iterate — without a human typing each sequence.",
    keyDifference:
      "Lemlist saves time on execution. Omni AI saves time on execution AND decision-making — the system picks the next move from operational memory, so you don't have to.",
    table: [
      {
        category: "Primary function",
        them: "Cold email + personalized video with templates",
        us: "End-to-end autonomous revenue system",
      },
      {
        category: "Creative origination",
        them: "Human-written templates; AI assist for variations",
        us: "AI writes per-contact copy + produces video from scratch",
      },
      {
        category: "Channel coverage",
        them: "Email + personalized video + basic landing pages",
        us: "Email, LinkedIn, video, landing pages, retargeting ads",
      },
      {
        category: "Optimization",
        them: "Manual A/B testing in the dashboard",
        us: "Auto-promotes winners, retires losers, no human input",
      },
      {
        category: "Pricing model",
        them: "Per-seat ($39–$199/user/mo)",
        us: "Flat platform tiers; no per-seat tax",
      },
    ],
    pros: [
      "Fastest path to personalized video-in-email at scale",
      "Affordable entry tier for solo outbound operators",
      "Strong deliverability tooling + warm-up built in",
      "Clean UI — easy for non-technical sellers to ship sequences",
    ],
    cons: [
      "Template-driven — you still write the copy",
      "Manual A/B testing; no autonomous promotion of winning variants",
      "Per-seat pricing multiplies as team grows",
      "Focused on cold email specifically — limited multi-channel native",
    ],
    faqs: [
      {
        question: "Is Omni AI a Lemlist alternative?",
        answer:
          "Yes — Omni AI covers cold email, personalized video, and landing pages natively, plus AI-generated copy, LinkedIn outreach, retargeting ads, and autonomous optimization. Teams typically switch from Lemlist when they hit the ceiling of 'I still have to write every template myself.'",
      },
      {
        question: "Does Omni AI do personalized video like Lemlist?",
        answer:
          "Yes. Omni AI generates personalized video variants for each prospect and auto-tests which opening, framing, and voiceover performs best. The winning variant gets promoted across the campaign automatically — no human QA loop.",
      },
      {
        question: "How does Omni AI's cold email deliverability compare?",
        answer:
          "Omni AI follows the same cold email hygiene Lemlist does — inbox warm-up, rotating sending domains, reply-rate-based pacing. Deliverability is a technical hygiene issue more than a platform issue; both work if configured correctly.",
      },
      {
        question: "Can I import my Lemlist campaigns?",
        answer:
          "Yes. Export your Lemlist sequence as a starting point and Omni AI will use it to seed its autonomous copy generation for the campaign. The system then writes variants and tests them against your original — usually beating the human-written baseline within 2 weeks.",
      },
    ],
    integrationNote:
      "Omni AI can import Lemlist sequences as a seed or replace the cold-email layer entirely — most teams migrate fully once autopilot consistently beats their original templates.",
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
