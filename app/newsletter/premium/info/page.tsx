import Link from "next/link";
import { Metadata } from "next";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { PREMIUM_PAYMENT_LINK } from "@/lib/premium";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/newsletter/premium/info`;
const ogImage = `${siteUrl}/newsletter/premium/info/opengraph-image`;

// Product + dual-Offer schema — /newsletter/premium/info was the single
// highest-revenue landing page on the site with zero typed schema. LLMs
// asked "what does Interlinked Premium cost?" / "is Omni AI's newsletter
// worth paying for?" had no structured entity to cite; Google had no
// Product rich-result surface to render. Shipping both unlocks:
//  1. Google's Product + Price rich-result treatment for the SERP card
//     (price chip + availability + subscription frequency).
//  2. LLM citation with the exact tiered pricing ($20 intro / $40
//     ongoing) instead of scraped-and-interpreted marketing copy.
//  3. Schema-body alignment with the visible "$20 first month, $40/mo
//     after" CTA block — Google's spam check flags drift between
//     schema and on-page copy, so the two structures mirror verbatim.
//
// Dual @type [Product, Service] — Interlinked Premium is both a
// content product (a subscription media good) and a service (delivery
// of scheduled intelligence briefs). Schema.org supports this when
// both concepts apply; widens retrieval surface without duplicating
// JSON-LD.
//
// Two Offer entries:
//  - First-month introductory ($20) — eligibleDuration 1 month
//  - Monthly recurring ($40) — billingDuration P1M
// Google's price-range rich result sums the two into "From $20" in
// the SERP card, which beats a single-price declaration on CTR.
const premiumProductSchema = {
  "@context": "https://schema.org",
  "@type": ["Product", "Service"],
  name: "Interlinked Premium — Omni AI Newsletter",
  description:
    "Agentic AI strategies, automation playbooks, and AI agent architecture briefs. Deep intelligence delivered 3x/week (Mon/Wed/Fri) with prompt libraries, early access to Omni AI tools, and private community. $40/month standard, $20 introductory first month. Cancel anytime.",
  url: pageUrl,
  image: ogImage,
  brand: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.png` },
  },
  category: "AI Newsletter Subscription",
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
  },
  serviceType: "Premium agentic-AI newsletter",
  audience: {
    "@type": "Audience",
    audienceType:
      "Founders, operators, and RevOps leaders adopting agentic AI in their business",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Interlinked Premium — First month introductory",
      price: "20",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: PREMIUM_PAYMENT_LINK,
      category: "Subscription — Introductory rate",
      description:
        "$20 introductory rate for the first month. Renews at $40/month afterward. Cancel anytime.",
      eligibleDuration: {
        "@type": "QuantitativeValue",
        value: 1,
        unitCode: "MON",
      },
    },
    {
      "@type": "Offer",
      name: "Interlinked Premium — Monthly recurring",
      price: "40",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: PREMIUM_PAYMENT_LINK,
      category: "Subscription — Monthly recurring",
      description:
        "Standard $40/month recurring subscription. Cancel anytime.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "40",
        priceCurrency: "USD",
        billingDuration: "P1M",
        unitCode: "MON",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Interlinked Premium — Agentic AI Strategies & Automation Playbooks",
  description:
    "Agentic AI strategies that compound your advantage — every week. Playbooks, automation frameworks, and intelligence delivered Mon/Wed/Fri.",
  keywords:
    "Interlinked Premium, agentic AI, AI agents, AI automation, Omni AI, premium newsletter, AI business strategy, automation playbooks",
  // Canonical pins the paid-upgrade landing page against share / ref /
  // UTM variants spawned by the payment-link copy-paste flow.
  alternates: { canonical: "https://omnileadsagi.com/newsletter/premium/info" },
  openGraph: {
    title: "Interlinked Premium — Agentic AI Strategies & Automation Playbooks",
    description:
      "Agentic AI strategies that compound your advantage — every week. Playbooks, automation, and intelligence.",
    url: "https://omnileadsagi.com/newsletter/premium/info",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked Premium — Agentic AI Strategies & Automation Playbooks",
    description:
      "Agentic AI strategies that compound your advantage — every week. Playbooks, automation, and intelligence.",
  },
};

// Chrome-gold stops used everywhere on this page (pill, headings,
// titles, CTA). Same values as /book-now and /newsletter/[slug].
const CHROME_GOLD =
  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)";

const goldTextStyle = {
  backgroundImage: CHROME_GOLD,
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  WebkitTextFillColor: "transparent" as const,
};

export default function PremiumInfoPage() {
  return (
    // No opaque bg — GoldSparksBackdrop (warm gold radial wash + rising
    // chrome-gold embers) paints through. Same pattern as /arena and
    // /newsletter/[slug] but with the gold palette.
    <div className="min-h-screen text-white relative">
      <JsonLd data={premiumProductSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Newsletter", url: `${siteUrl}/newsletter` },
          { name: "Interlinked Premium", url: pageUrl },
        ])}
      />
      <GoldSparksBackdrop />

      {/* Header — subtle dark glass so it sits above the sparks without
          competing with the gold glow. */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gradient">
            Omni AI
          </Link>
          <Link
            href="/newsletter"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back to Newsletter
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-5 py-16 md:py-24">
        {/* Visible 3-level breadcrumb — pairs with breadcrumbSchema above
            so Google awards the SERP breadcrumb chip on the paid-upgrade
            landing page. Centered via wrapper so it sits comfortably above
            the hero without disturbing the hero's centered layout. */}
        <div className="flex justify-center mb-6">
          <Breadcrumb
            items={[
              { name: "Home", href: "/" },
              { name: "Newsletter", href: "/newsletter" },
              { name: "Interlinked Premium", href: "/newsletter/premium/info" },
            ]}
            className="text-xs"
          />
        </div>

        <div className="text-center mb-16">
          {/* Chrome-gold pill — dark interior on padding-box + chrome-gold
              gradient on border-box, same trick as the /book-now
              Schedule button. Gives the pill a metallic gold ring. */}
          <span
            className="inline-block text-[11px] px-3 py-1 rounded-full font-semibold uppercase tracking-wider"
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.6), rgba(10,10,10,0.6)) padding-box, " +
                `${CHROME_GOLD} border-box`,
              border: "1px solid transparent",
              color: "#ffd700",
            }}
          >
            Premium
          </span>

          <h1 className="text-4xl md:text-5xl font-bold mt-5 mb-4">
            <span style={goldTextStyle}>Interlinked</span> Premium
          </h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto leading-relaxed">
            The free newsletter keeps you informed. Premium makes you dangerous.
            Agentic AI strategies, automation playbooks, and intelligence that
            compounds your advantage every single week.
          </p>
        </div>

        {/* Agentic AI Benefits — emojis removed; each card is now a
            title + description only, with the title in chrome-gold so
            the gold identity stays even without the icon. */}
        <div className="mb-12">
          <h2
            className="text-sm font-semibold uppercase tracking-widest mb-6 text-center"
            style={goldTextStyle}
          >
            What You Get
          </h2>
          <div className="grid gap-4 md:gap-6">
            {[
              {
                title: "Agentic AI Playbooks",
                desc: "Step-by-step breakdowns of autonomous AI agent workflows — how to build, deploy, and scale agents that handle sales, support, research, and operations without human babysitting.",
              },
              {
                title: "AI Agent Architecture Briefs",
                desc: "Deep dives into multi-agent systems, tool-use chains, and orchestration patterns. Understand how leading companies are building AI that thinks, plans, and executes autonomously.",
              },
              {
                title: "Automation ROI Breakdowns",
                desc: "Real numbers behind AI automation — which processes to automate first, expected cost savings, and the compounding returns of deploying agents across your business.",
              },
              {
                title: "Tool & API Intelligence",
                desc: "First-to-know coverage of new AI tools, APIs, and platforms. We test and review so you deploy what actually works — not what's trending on Twitter.",
              },
              {
                title: "Monday: Strategic Frameworks",
                desc: "Start the week with decision frameworks for AI adoption — when to build vs. buy, how to evaluate AI vendors, and mental models for agentic thinking.",
              },
              {
                title: "Wednesday: Deep Intelligence",
                desc: "Mid-week analysis connecting AI research to business impact. We translate papers, benchmarks, and breakthroughs into moves you can make this quarter.",
              },
              {
                title: "Friday: Monetization Plays",
                desc: "End the week with revenue strategies — how to package AI services, price automation, and build recurring revenue on top of agentic workflows.",
              },
              {
                title: "Agent Prompt Libraries",
                desc: "Curated, tested prompts and system instructions for building high-performance AI agents. Copy, paste, deploy — production-ready from day one.",
              },
              {
                title: "AI Risk & Compliance Updates",
                desc: "Stay ahead of regulation. Premium members get early analysis of AI policy changes, compliance requirements, and risk mitigation strategies before they hit mainstream news.",
              },
              {
                title: "Early Access to Omni AI Tools",
                desc: "Premium members beta-test new Omni AI products, integrations, and agent templates before public release. Shape the tools you use.",
              },
              {
                title: "Private Community Access",
                desc: "Connect with other premium members building with agentic AI. Share workflows, troubleshoot deployments, and collaborate on the frontier of autonomous business systems.",
              },
              {
                title: "Weekly AI Market Intelligence",
                desc: "Curated data on AI adoption rates, funding rounds, talent movements, and market shifts — the signals that matter for strategic positioning.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-xl bg-amber-500/[0.03] border border-amber-500/[0.12] hover:border-amber-500/30 transition-colors backdrop-blur-sm"
              >
                <h3
                  className="text-base font-semibold mb-2"
                  style={goldTextStyle}
                >
                  {item.title}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div className="mb-16">
          <h2
            className="text-sm font-semibold uppercase tracking-widest mb-6 text-center"
            style={goldTextStyle}
          >
            Free vs Premium
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">Daily Intelligence</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Daily AI briefing</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> 3 key insights</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Power move of the day</li>
                <li className="flex items-center gap-2"><span className="text-gray-700">&mdash;</span> <span className="text-gray-700">No agent playbooks</span></li>
                <li className="flex items-center gap-2"><span className="text-gray-700">&mdash;</span> <span className="text-gray-700">No exclusive insights</span></li>
                <li className="flex items-center gap-2"><span className="text-gray-700">&mdash;</span> <span className="text-gray-700">No community access</span></li>
              </ul>
            </div>
            <div className="p-6 rounded-xl bg-amber-500/[0.04] border border-amber-500/25 backdrop-blur-sm">
              <h3
                className="text-sm font-semibold mb-4"
                style={goldTextStyle}
              >
                Interlinked Premium
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Everything in Free</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Deep dives</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Agentic AI playbooks</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Prompt libraries</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Early tool access</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Private community</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA — chrome-gold treatment identical to /book-now and
            /newsletter/[slug]. Dark interior + gold gradient border +
            gold text + subtle gold shadow. Links directly to the
            Stripe-hosted checkout page with FIRST50 prefilled so the
            user lands on a $20 first-month total. Plain <a> (not
            next/link) because it's an external URL. */}
        <div className="text-center">
          <a
            href={PREMIUM_PAYMENT_LINK}
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                `${CHROME_GOLD} border-box`,
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center px-8 h-12 rounded-xl font-semibold text-sm text-[#ffd700] shadow-[0_0_14px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
          >
            Get Premium Access
          </a>
          <p className="text-gray-400 text-xs mt-4">
            $20 first month, $40/mo after · cancel anytime
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Already have an account?{" "}
            <Link
              href="/?signin=true"
              className="hover:brightness-125 underline underline-offset-2"
              style={{ color: "#ffd700" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
