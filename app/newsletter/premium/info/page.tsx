import Link from "next/link";
import { Metadata } from "next";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { PREMIUM_PAYMENT_LINK } from "@/lib/premium";

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
