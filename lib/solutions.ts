// Single source of truth for the /solutions à la carte services page.
// Brand facts (names, prices, plan IDs) live here, never inline in JSX.
//
// Billing model (locked with Sita):
//   - "once"    → one-time PayPal payment (PayPalOrderButton, amount baked).
//   - "monthly" → recurring PayPal subscription (PayPalSubscribeButton, planId).
//   - "quote"   → no fixed amount (price is a range like "$80,000+"); Book-a-call only.
//
// Monthly plan IDs were created live via scripts/paypal-create-solutions-plans.mjs
// (product PROD-0LN44458KX2969415). Meta Ads reuses the existing plan from /meta.

export type Billing = "once" | "monthly" | "quote";

export type Solution = {
  key: string;
  name: string;
  kind?: string; // small subtitle, e.g. "Bespoke Next.js"
  blurb: string;
  bullets: string[];
  price: string; // display string, e.g. "$25,000", "$1,500/mo", "$80,000+"
  amount?: string; // numeric USD string for one-time orders, e.g. "25000"
  billing: Billing;
  planId?: string; // for monthly subscriptions
  bookCall?: boolean; // also show a "Book a call" CTA
  href?: string; // optional cross-link (e.g. existing /meta page)
  featured?: boolean;
};

export const BOOK_CALL_URL = "/book-now";

// ── Websites — 3 tiers (one-time). Copy drawn from lib/case-study-tiers.ts. ──
export const WEBSITE_TIERS: Solution[] = [
  {
    key: "web-agentic",
    name: "Agentic Website",
    kind: "Bespoke Next.js",
    blurb:
      "A custom codebase and design system, engineered to convert and built to rank. Your AI CEO layer included from day one.",
    bullets: [
      "Custom Next.js build — no templates, no theme limits",
      "Bespoke design system tuned to your brand",
      "Full JSON-LD schema + SEO/GEO foundation",
      "Analytics pipeline + AI CEO layer included",
    ],
    price: "$25,000",
    amount: "25000",
    billing: "once",
  },
  {
    key: "web-federation",
    name: "Federation Build",
    kind: "Sovereign Empire",
    blurb:
      "Everything in the Agentic Website, plus federation distribution and multi-site AI CEO orchestration across your network.",
    bullets: [
      "Everything in Agentic Website",
      "Federation distribution + cross-promo network",
      "Multi-site AI CEO orchestration",
      "Sponsor + booking attribution wired in",
    ],
    price: "$50,000",
    amount: "50000",
    billing: "once",
  },
  {
    key: "web-empire",
    name: "Sovereign Empire",
    kind: "Full Federation",
    blurb:
      "The flagship: a retained, multi-site empire with ongoing AI CEO operation. Scoped to your revenue at stake.",
    bullets: [
      "Multi-site empire, retained operation",
      "Dedicated AI CEO orchestration at scale",
      "Federation revenue + sponsor curation",
      "Custom scope — built around your goals",
    ],
    price: "$80,000+",
    amount: "80000",
    billing: "once",
    featured: true,
  },
];

// ── À la carte services. Flagship + one-time builds + monthly retainers. ──
export const SOLUTIONS: Solution[] = [
  {
    key: "ai-ceo",
    name: "AI CEO",
    kind: "Advanced marketing capabilities",
    blurb:
      "An autonomous AI CEO that runs your marketing engine end to end — strategy, creative, distribution, and optimization, around the clock.",
    bullets: [
      "Autonomous strategy + decisioning layer",
      "Advanced marketing + creative generation",
      "Cross-channel distribution + optimization",
      "Reports to you in plain English",
    ],
    price: "$100,000+",
    amount: "100000",
    billing: "once",
    featured: true,
  },
  {
    key: "crm",
    name: "Custom CRM Build-Out",
    blurb:
      "A CRM built around how you actually sell — pipelines, automations, and integrations wired to your stack, not a generic SaaS box.",
    bullets: [
      "Custom pipelines + stages tuned to your sales motion",
      "Automations, reminders, and lead routing",
      "Integrations with your existing tools",
      "Dashboards + reporting built in",
    ],
    price: "$15,000",
    amount: "15000",
    billing: "once",
  },
  {
    key: "newsletter",
    name: "Hyper-Advanced Agentic Newsletter",
    blurb:
      "A newsletter that writes, curates, and ships itself — agentic research and drafting tuned to your audience, on autopilot.",
    bullets: [
      "Agentic research + drafting every issue",
      "Audience-tuned subjects and segmentation",
      "Automated scheduling + delivery",
      "Performance reporting per send",
    ],
    price: "$1,500/mo",
    billing: "monthly",
    planId: "P-7VE35658JR630005ENIZAE2Y",
  },
  {
    key: "seo-geo",
    name: "SEO & GEO Optimization",
    blurb:
      "Rank in search and in the AI answers. Full technical SEO plus GEO (generative engine optimization) so you show up where buyers now look.",
    bullets: [
      "Technical SEO + on-page optimization",
      "GEO: optimized for AI/LLM answer engines",
      "JSON-LD schema + local/city pages",
      "Monthly keyword + visibility reporting",
    ],
    price: "$2,500/mo",
    billing: "monthly",
    planId: "P-5J038847XE322944WNIZAE3A",
  },
  {
    key: "email-sms",
    name: "Email & SMS Marketing",
    blurb:
      "Done-for-you lifecycle email and SMS — flows, broadcasts, and automations that recover revenue and keep you top of mind.",
    bullets: [
      "Lifecycle flows + broadcast campaigns",
      "Deliverability + compliance guardrails",
      "Segmentation + A/B testing",
      "Revenue attribution reporting",
    ],
    price: "$1,500/mo",
    billing: "monthly",
    planId: "P-3G973560E9259721JNIZAE3A",
  },
  {
    key: "social",
    name: "Social Media Automation",
    blurb:
      "Always-on social presence — content generated, scheduled, and posted across platforms, with engagement handled by AI.",
    bullets: [
      "AI content generation across platforms",
      "Automated scheduling + multi-channel posting",
      "Engagement + DM automation",
      "Growth + performance reporting",
    ],
    price: "$1,500/mo",
    billing: "monthly",
    planId: "P-86373165K8546784XNIZAE3A",
  },
  {
    key: "cybersecurity",
    name: "Cybersecurity Services",
    blurb:
      "Proactive protection for your sites and systems — monitoring, hardening, and threat response so you never ship a breach.",
    bullets: [
      "24/7 monitoring + threat detection",
      "Security hardening + DDoS protection",
      "Vulnerability scanning + patching",
      "Incident response + reporting",
    ],
    price: "$2,000/mo",
    billing: "monthly",
    planId: "P-0FB53846S54003837NIZAE3A",
  },
  {
    key: "lead-gen",
    name: "Lead Generation / Autonomous Outbound",
    blurb:
      "An autonomous outbound engine that finds, enriches, and reaches your ideal customers — filling your pipeline while you sleep.",
    bullets: [
      "ICP targeting + lead enrichment",
      "Autonomous multi-channel outreach",
      "Reply handling + meeting booking",
      "Pipeline + conversion reporting",
    ],
    price: "$2,500/mo",
    billing: "monthly",
    planId: "P-9CS92975YP255715CNIZAE3I",
  },
  {
    key: "chatbot-voice",
    name: "AI Chatbot + Voice Agent",
    blurb:
      "A 24/7 AI agent that answers, qualifies, and books — on your website chat and on the phone — in your brand voice.",
    bullets: [
      "Website chatbot trained on your business",
      "AI voice agent for inbound + outbound calls",
      "Lead qualification + booking",
      "Transcripts + handoff to your team",
    ],
    price: "$1,000/mo",
    billing: "monthly",
    planId: "P-5TT368548N846132YNIZAE3I",
  },
  {
    key: "analytics",
    name: "Analytics & Telemetry Dashboard",
    blurb:
      "One live dashboard for everything that matters — traffic, leads, revenue, and AI-agent activity — refreshed in real time.",
    bullets: [
      "Unified real-time KPI dashboard",
      "Traffic, leads, revenue, and agent telemetry",
      "Custom alerts + weekly digests",
      "Shareable stakeholder reporting",
    ],
    price: "$750/mo",
    billing: "monthly",
    planId: "P-0JE54840V23731416NIZAE3I",
  },
  {
    key: "hosting",
    name: "Hosting + Maintenance Retainer",
    blurb:
      "Enterprise-grade hosting plus ongoing maintenance — updates, backups, uptime monitoring, and content support, handled.",
    bullets: [
      "Vercel + Supabase infrastructure",
      "Updates, backups, uptime monitoring",
      "Content + small-change support",
      "AI-powered performance scaling",
    ],
    price: "$1,000/mo",
    billing: "monthly",
    planId: "P-81S03289VY953274MNIZAE3I",
  },
  {
    key: "meta-ads",
    name: "Meta Ads, Managed by AI",
    blurb:
      "A done-for-you Facebook + Instagram ad engine, run end to end by AI — fresh creative weekly and 24/7 optimization.",
    bullets: [
      "30+ fresh ad creatives every month",
      "Full Meta + pixel + CAPI setup",
      "Daily AI optimization",
      "Weekly performance reporting",
    ],
    price: "$1,500/mo",
    billing: "monthly",
    planId: "P-0CW08001LU923782MNIUHR6I",
    href: "/meta",
  },
];
