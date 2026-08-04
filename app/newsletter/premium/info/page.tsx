import type { Metadata } from "next";
import Link from "next/link";
import {
  BrainCircuit,
  CalendarDays,
  Lightbulb,
  Radar,
  Workflow,
} from "lucide-react";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { PremiumEmailSignup } from "@/components/premium-email-signup";
import { PremiumLimitedBanner } from "@/components/premium-limited-banner";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/newsletter/premium/info`;

export const metadata: Metadata = {
  title: "Join Interlinked Premium Free — Limited Time | Omni AI",
  description:
    "Get Interlinked Premium free for a limited time. Enter your email for current agentic AI intelligence, operator playbooks, architecture briefs, and three premium issues each week.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "Interlinked Premium Is Free for a Limited Time",
    description:
      "Current agentic AI intelligence, practical playbooks, architecture briefs, and three premium issues each week—delivered by Omni AI.",
    url: pageUrl,
    siteName: "Omni AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked Premium Is Free for a Limited Time",
    description:
      "Join with your email for current agentic AI intelligence, practical playbooks, and three premium issues each week.",
  },
};

const premiumPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Interlinked Premium — Free Limited-Time Email Signup",
  description:
    "A limited-time email signup for Interlinked Premium from Omni AI, featuring current agentic AI intelligence, operator playbooks, architecture briefs, and three premium issues each week.",
  url: pageUrl,
  isPartOf: {
    "@type": "WebSite",
    name: "Omni AI",
    url: siteUrl,
  },
};

const benefits = [
  {
    icon: Radar,
    title: "Current agentic AI intelligence",
    description:
      "Premium briefs built around what is moving now—new agent releases, infrastructure shifts, market signals, and operator implications.",
  },
  {
    icon: Workflow,
    title: "Moves you can put to work",
    description:
      "Practical playbooks, workflows, and decision frameworks that turn industry developments into actions for your business.",
  },
  {
    icon: BrainCircuit,
    title: "Architecture without the noise",
    description:
      "Clear breakdowns of agent control planes, orchestration, governance, tools, and the systems behind reliable AI operations.",
  },
  {
    icon: CalendarDays,
    title: "Three premium issues each week",
    description:
      "Start Monday with strategy, use Wednesday for deeper analysis, and close Friday with an operating or monetization move.",
  },
  {
    icon: Lightbulb,
    title: "One clear recommendation",
    description:
      "Every issue ends with a focused recommendation or power move so you know what deserves attention—and what to do next.",
  },
];

export default function PremiumInfoPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <JsonLd data={premiumPageSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Newsletter", url: `${siteUrl}/newsletter` },
          { name: "Interlinked Premium", url: pageUrl },
        ])}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[980px] bg-[url('/newsletter/generated/interlinked-premium-signup-bg.webp')] bg-[length:auto_900px] bg-[position:18%_top] bg-no-repeat opacity-85 sm:h-[1120px] sm:bg-cover sm:bg-center sm:opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[980px] bg-[linear-gradient(180deg,rgba(0,0,0,0.30)_0%,rgba(0,0,0,0.14)_52%,#000_100%)] sm:h-[1120px] sm:bg-[linear-gradient(180deg,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.18)_48%,#000_100%)]"
      />

      <PremiumLimitedBanner />

      <header className="relative z-10 border-b border-white/[0.07] bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="text-xl font-bold text-gradient">
            Omni AI
          </Link>
          <Link
            href="/newsletter"
            className="text-sm text-white/55 transition-colors hover:text-white"
          >
            Back to Newsletter
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-20 lg:pb-28">
        <section className="mx-auto max-w-5xl text-left sm:text-center">
          <h1 className="font-bold tracking-[-0.045em] text-[clamp(1.75rem,8.6vw,3rem)] sm:text-6xl lg:text-7xl">
            <span className="block whitespace-nowrap">Know what’s next.</span>
            <span className="block bg-gradient-to-r from-amber-200 via-yellow-400 to-violet-400 bg-clip-text text-transparent sm:whitespace-nowrap">
              <span className="block sm:inline">Know what to do</span>{" "}
              <span className="block sm:inline">with it.</span>
            </span>
          </h1>

          <p className="mr-auto mt-5 max-w-[21rem] text-pretty text-[15px] leading-6 text-white/70 sm:mx-auto sm:mt-6 sm:max-w-2xl sm:text-lg sm:leading-8">
            Current agentic AI intelligence—decoded into clear decisions,
            practical systems, and moves you can make now.
          </p>

          <div className="mx-auto mt-7 max-w-2xl sm:mt-9">
            <PremiumEmailSignup />
          </div>

          <p className="mt-3 text-left text-xs text-white/40 sm:mt-4 sm:text-center">
            No payment required. Unsubscribe anytime.
          </p>
        </section>

        <section className="mt-16 sm:mt-24" aria-labelledby="premium-includes">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-300/80">
              Your premium access
            </p>
            <h2
              id="premium-includes"
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              More signal. More leverage.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {benefits.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className={[
                  "group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-md transition-colors hover:border-amber-300/25 hover:bg-amber-300/[0.045]",
                  index < 3 ? "lg:col-span-2" : "lg:col-span-3",
                ].join(" ")}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
