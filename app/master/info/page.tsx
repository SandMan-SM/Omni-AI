import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Activity,
  Phone,
  MousePointerClick,
  Eye,
  Bell,
  TrendingUp,
  Bot,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Master Tier — Omni AI",
  description:
    "What's inside the Master tier: the highest level of the Omni AI dashboard. Live analytics, agentic agents, lead routing, and call tracking for your live digital assets.",
  alternates: { canonical: "https://omnileadsagi.com/master/info" },
};

const TIER_BENEFITS = [
  {
    icon: Activity,
    title: "Live analytics dashboard",
    desc: "Every page view, every button click, every form submit on your site streams to your dashboard in real time. No 24-hour delay, no aggregated weekly digest — live.",
  },
  {
    icon: Phone,
    title: "Call tracking, click by click",
    desc: "Every tel: link tap is counted, attributed to the page that drove it, and totaled by the day and the week. You see exactly which content turns visitors into calls.",
  },
  {
    icon: MousePointerClick,
    title: "Top buttons + top pages",
    desc: "The dashboard ranks every CTA, link, and button by how often it gets clicked. Same with pages. You learn what works without guessing.",
  },
  {
    icon: Bell,
    title: "Lead alerts on your phone",
    desc: "The moment a contact form is submitted on your site, the lead lands in the dashboard, fires an email to your inbox, and pings your phone via Telegram. No lead goes unseen.",
  },
  {
    icon: Bot,
    title: "Agentic agents in development",
    desc: "Autonomous agents that watch trends in your market, spin up new pages and posts to meet them, and nurture leads from first read to first booking — the marketing engine moving at the speed of search.",
  },
  {
    icon: Search,
    title: "SEO + GEO optimization",
    desc: "Two engines: Google search visibility (SEO) and AI assistant visibility (GEO — when ChatGPT, Claude, Perplexity recommend who to call, your assets are what they suggest).",
  },
  {
    icon: TrendingUp,
    title: "Compounding digital assets",
    desc: "Every page, every blog post, every condition guide is a small, self-contained answer that an AI or a search engine can find and surface forever. The library compounds.",
  },
  {
    icon: Sparkles,
    title: "Priority support",
    desc: "Direct line to the build team for questions, edits, and new ideas. You don't file tickets — you get answers.",
  },
];

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "Your site is instrumented",
    desc: "A lightweight tracker fires every interaction to your dashboard. No cookies, no third-party scripts — just signal you own.",
  },
  {
    n: "2",
    title: "Leads route automatically",
    desc: "Contact submissions hit your inbox via SMTP and your dashboard via the lead intake API. You get the alert before the visitor closes the tab.",
  },
  {
    n: "3",
    title: "Agents iterate on what works",
    desc: "Top pages get more sibling content. Top buttons get duplicated on adjacent pages. Underperformers get rewritten. The engine learns what your audience actually responds to.",
  },
  {
    n: "4",
    title: "You watch the numbers move",
    desc: "Open the dashboard. See leads, calls, pages, clicks. Make decisions from data, not vibes.",
  },
];

export default function MasterInfoPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-cyan-950/20 to-blue-900/30" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-12 sm:py-16 md:py-20">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-blue-300/70 hover:text-blue-200 mb-6 transition-colors"
          >
            <ArrowRight className="w-3 h-3 rotate-180" aria-hidden />
            Back to dashboard
          </Link>

          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 p-[1px] flex-shrink-0">
              <div className="w-full h-full rounded-2xl bg-[#050508] flex items-center justify-center">
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-400" aria-hidden />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-blue-400 font-semibold mb-1">
                Tier
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight">
                <span className="bg-gradient-to-r from-blue-200 via-cyan-300 to-blue-200 bg-clip-text text-transparent">
                  Master
                </span>
              </h1>
            </div>
          </div>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl leading-relaxed mb-6">
            The highest tier of the Omni AI dashboard. Live analytics, autonomous
            marketing agents, instant lead routing, and full call tracking — built
            around the digital assets we&apos;ve created for your business.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            Activated on your account
          </div>
        </div>
      </section>

      {/* What's inside */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">What&apos;s inside</h2>
        <p className="text-sm text-gray-500 mb-8">
          Everything Master gives you — already on your dashboard.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {TIER_BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <Card
                key={b.title}
                className="bg-white/[0.03] border-white/[0.06] hover:border-blue-500/30 transition-colors"
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-blue-400" aria-hidden />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                    {b.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{b.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">How it works</h2>
          <p className="text-sm text-gray-500 mb-8">
            The four-step loop running in the background.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {HOW_IT_WORKS.map((s) => (
              <div
                key={s.n}
                className="flex gap-4 p-5 sm:p-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 text-sm font-black text-[#050508]">
                  {s.n}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                    {s.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-10 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Where alerts land</h2>
        <p className="text-sm text-gray-500 mb-8">
          When a lead comes in, three things happen at once.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-5 sm:p-6">
              <Eye className="w-5 h-5 text-violet-400 mb-3" aria-hidden />
              <h3 className="font-bold mb-1.5">Dashboard</h3>
              <p className="text-sm text-gray-400">
                Lead appears in your /dashboard within 30 seconds.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-5 sm:p-6">
              <Mail className="w-5 h-5 text-emerald-400 mb-3" aria-hidden />
              <h3 className="font-bold mb-1.5">Email</h3>
              <p className="text-sm text-gray-400">
                Resend sends a formatted notification to your owner inbox.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-5 sm:p-6">
              <MessageSquare className="w-5 h-5 text-blue-400 mb-3" aria-hidden />
              <h3 className="font-bold mb-1.5">Telegram</h3>
              <p className="text-sm text-gray-400">
                A push hits your phone with click-to-call and click-to-email
                buttons baked in.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA back */}
      <section className="border-t border-white/10 bg-gradient-to-br from-blue-950/40 to-cyan-950/30">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-10 py-12 sm:py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" aria-hidden />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            You&apos;re already on Master
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Everything above is live on your account right now. Open the
            dashboard to see today&apos;s numbers.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 hover:from-blue-400 hover:to-cyan-500 text-white font-bold shadow-lg shadow-cyan-400/25 transition-all"
          >
            Open the dashboard
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
