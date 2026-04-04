import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interlinked Premium — Agentic AI Strategies & Automation Playbooks",
  description:
    "Agentic AI strategies that compound your advantage — every week. Playbooks, automation frameworks, and intelligence delivered Mon/Wed/Fri.",
  keywords:
    "Interlinked Premium, agentic AI, AI agents, AI automation, Omni AI, premium newsletter, AI business strategy, automation playbooks",
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

export default function PremiumInfoPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/5">
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

      <main className="max-w-3xl mx-auto px-5 py-16 md:py-24">
        <div className="text-center mb-16">
          <span className="text-[11px] px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-semibold uppercase tracking-wider">
            Premium
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mt-5 mb-4">
            <span className="text-yellow-400">Interlinked</span> Premium
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
            The free newsletter keeps you informed. Premium makes you dangerous.
            Agentic AI strategies, automation playbooks, and intelligence that
            compounds your advantage every single week.
          </p>
        </div>

        {/* Agentic AI Benefits */}
        <div className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-yellow-400/60 mb-6 text-center">
            What You Get
          </h2>
          <div className="grid gap-4 md:gap-5">
            {[
              {
                icon: "\u2699\ufe0f",
                title: "Agentic AI Playbooks",
                desc: "Step-by-step breakdowns of autonomous AI agent workflows — how to build, deploy, and scale agents that handle sales, support, research, and operations without human babysitting.",
              },
              {
                icon: "\ud83e\udde0",
                title: "AI Agent Architecture Briefs",
                desc: "Deep dives into multi-agent systems, tool-use chains, and orchestration patterns. Understand how leading companies are building AI that thinks, plans, and executes autonomously.",
              },
              {
                icon: "\ud83d\udcc8",
                title: "Automation ROI Breakdowns",
                desc: "Real numbers behind AI automation — which processes to automate first, expected cost savings, and the compounding returns of deploying agents across your business.",
              },
              {
                icon: "\ud83d\udd17",
                title: "Tool & API Intelligence",
                desc: "First-to-know coverage of new AI tools, APIs, and platforms. We test and review so you deploy what actually works — not what's trending on Twitter.",
              },
              {
                icon: "\ud83c\udfaf",
                title: "Monday: Strategic Frameworks",
                desc: "Start the week with decision frameworks for AI adoption — when to build vs. buy, how to evaluate AI vendors, and mental models for agentic thinking.",
              },
              {
                icon: "\ud83d\udd2c",
                title: "Wednesday: Deep Intelligence",
                desc: "Mid-week analysis connecting AI research to business impact. We translate papers, benchmarks, and breakthroughs into moves you can make this quarter.",
              },
              {
                icon: "\ud83d\udcb0",
                title: "Friday: Monetization Plays",
                desc: "End the week with revenue strategies — how to package AI services, price automation, and build recurring revenue on top of agentic workflows.",
              },
              {
                icon: "\ud83e\udd16",
                title: "Agent Prompt Libraries",
                desc: "Curated, tested prompts and system instructions for building high-performance AI agents. Copy, paste, deploy — production-ready from day one.",
              },
              {
                icon: "\ud83d\udee1\ufe0f",
                title: "AI Risk & Compliance Updates",
                desc: "Stay ahead of regulation. Premium members get early analysis of AI policy changes, compliance requirements, and risk mitigation strategies before they hit mainstream news.",
              },
              {
                icon: "\ud83d\ude80",
                title: "Early Access to Omni AI Tools",
                desc: "Premium members beta-test new Omni AI products, integrations, and agent templates before public release. Shape the tools you use.",
              },
              {
                icon: "\ud83c\udf10",
                title: "Private Community Access",
                desc: "Connect with other premium members building with agentic AI. Share workflows, troubleshoot deployments, and collaborate on the frontier of autonomous business systems.",
              },
              {
                icon: "\ud83d\udcca",
                title: "Weekly AI Market Intelligence",
                desc: "Curated data on AI adoption rates, funding rounds, talent movements, and market shifts — the signals that matter for strategic positioning.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-yellow-500/[0.02] border border-yellow-500/[0.08] hover:border-yellow-500/15 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-400 mb-1.5">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div className="mb-16">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-yellow-400/60 mb-6 text-center">
            Free vs Premium
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <h3 className="text-sm font-semibold text-purple-400 mb-3">Daily Intelligence</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Daily AI briefing</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> 3 key insights</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Power move of the day</li>
                <li className="flex items-center gap-2"><span className="text-gray-700">&mdash;</span> <span className="text-gray-700">No agent playbooks</span></li>
                <li className="flex items-center gap-2"><span className="text-gray-700">&mdash;</span> <span className="text-gray-700">No exclusive insights</span></li>
                <li className="flex items-center gap-2"><span className="text-gray-700">&mdash;</span> <span className="text-gray-700">No community access</span></li>
              </ul>
            </div>
            <div className="p-5 rounded-xl bg-yellow-500/[0.03] border border-yellow-500/[0.12]">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3">Interlinked Premium</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Everything in Free</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> 3x/week deep dives</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Agentic AI playbooks</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Prompt libraries</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Early tool access</li>
                <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Private community</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/?signin=true"
            className="inline-block bg-gradient-to-r from-yellow-600 to-yellow-500 text-black px-8 py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Get Premium Access
          </Link>
          <p className="text-gray-600 text-xs mt-3">
            Already have an account?{" "}
            <Link href="/?signin=true" className="text-yellow-500 hover:text-yellow-400 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
