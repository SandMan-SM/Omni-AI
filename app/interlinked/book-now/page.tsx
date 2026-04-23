"use client";
export const dynamic = "force-dynamic";
/**
 * Interlinked · Book a session
 * Landing target for every CTA that says "Book Now" in Interlinked emails
 * and the executive debrief. Uses the locked web primitives + reuses the
 * existing BookDemoModal for the actual scheduling flow.
 * Contract: docs/web-design-system.md. Accent: purple.
 */
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Clock, Sparkles, CheckCircle2, ArrowLeft } from "lucide-react";
import { BookDemoModal } from "@/components/modals/lazy";
import { Breadcrumb } from "@/components/breadcrumb";
import {
  PageShell,
  PageTopBar,
  PageHero,
  KpiGrid,
  SectionLabel,
  Card,
  PillBadge,
  CtaRow,
  PageFooter,
  WEB,
} from "@/components/ui/web-primitives";

const WHAT_YOU_GET = [
  {
    label: "Portfolio audit",
    body: "We look at your top 3 revenue levers and call out which one an AI agent can take off your plate this month — not in six.",
  },
  {
    label: "Live build preview",
    body: "We open the Omni AI Command Center and walk you through how a real agent ships content, closes leads, and reports in every morning.",
  },
  {
    label: "Concrete 90-day plan",
    body: "You leave with a one-page plan: what ships week 1, week 4, and week 12 — with the exact MRR or lead targets attached to each.",
  },
];

const AGENDA = [
  { t: "0–5 min", label: "Context", body: "Where you are now, where you want to be by end of quarter." },
  { t: "5–15 min", label: "Audit", body: "We pick the highest-ROI automation for your current stage." },
  { t: "15–25 min", label: "Demo", body: "Live Command Center walkthrough — same system running 5 paying clients today." },
  { t: "25–30 min", label: "Next step", body: "If it's a fit, we scope a pilot. If not, you keep the plan." },
];

export default function InterlinkedBookNowPage() {
  const [open, setOpen] = useState(false);

  return (
    <PageShell accent="purple">
      <PageTopBar
        label="Interlinked · Book a session"
        accent="purple"
        right={
          <Link
            href="/interlinked"
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] hover:opacity-80"
            style={{ color: WEB.textMuted }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to Interlinked
          </Link>
        }
      />

      {/* Visible breadcrumb — paired with the breadcrumbSchema in
          app/interlinked/book-now/layout.tsx. The PageTopBar "back to
          Interlinked" link is a single-parent shortcut; the breadcrumb
          surfaces the full Home → Interlinked → Book a session
          hierarchy for users landing from SERPs / LLM citations, and
          satisfies Google's visible-UI requirement for the breadcrumb
          SERP chip. `max-w-6xl mx-auto px-5 md:px-8` matches the
          PageHero container so horizontal rhythm stays clean. */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-6">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Interlinked", href: "/interlinked" },
            { name: "Book a session", href: "/interlinked/book-now" },
          ]}
          className="text-xs"
        />
      </div>

      <PageHero
        eyebrow="Free · 30-minute working session"
        title="Book a call with Omni AI"
        meta="Alfred Belvedere · typically responds within 12 hours · Zoom or in-person (SLC)"
        lede="Thirty minutes is enough to map one agent from idea to deployed. We open the Command Center, pick the automation that pays for itself fastest, and leave with a 90-day plan. No pitch deck, no slides — the build is the demo."
        accent="purple"
        /* ledeSpeakable activates the data-speakable="intro" marker on
           the lede paragraph. Pairs with the SpeakableSpecification on
           the WebPage schema in app/interlinked/book-now/layout.tsx.
           Voice assistants concatenate h1 ("Book a call with Omni AI") +
           lede as the natural ~14-second reply to "how do I book a call
           with Omni AI?" / "what is the free Omni AI consultation?"
           voice queries, with the Service hasOfferCatalog (portfolio
           audit / live build preview / concrete 90-day plan) available
           as the body of the answer. */
        ledeSpeakable
        right={
          <CtaRow
            primary={{ label: "Open scheduler", onClick: () => setOpen(true) }}
            secondary={{ label: "Learn more first", href: "/interlinked" }}
            accent="purple"
          />
        }
      />

      <KpiGrid
        items={[
          { value: "30 min", label: "Session length", color: WEB.purple },
          { value: "Free", label: "Working consult" },
          { value: "5", label: "Paying clients today", color: WEB.purple },
          { value: "<12h", label: "Average reply" },
        ]}
      />

      <SectionLabel accent="purple">What you&apos;ll leave with</SectionLabel>
      <Card>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {WHAT_YOU_GET.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex flex-col gap-3"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#1f1230", border: `1px solid ${WEB.purple}33` }}
              >
                <CheckCircle2 className="w-5 h-5" style={{ color: WEB.purple }} />
              </div>
              <p
                className="text-[11px] font-mono uppercase tracking-[0.16em]"
                style={{ color: WEB.purple }}
              >
                {it.label}
              </p>
              <p className="text-[15px] leading-[1.7]" style={{ color: WEB.textBody }}>
                {it.body}
              </p>
            </motion.div>
          ))}
        </div>
      </Card>

      <SectionLabel accent="purple" right={
        <span className="text-[11px] font-mono" style={{ color: WEB.textSubtle }}>
          30-min agenda
        </span>
      }>
        How the call runs
      </SectionLabel>
      <Card padding="p-2 md:p-3">
        <div className="divide-y" style={{ borderColor: WEB.borderDefault }}>
          {AGENDA.map((row, i) => (
            <div
              key={i}
              className="flex items-start gap-4 px-4 md:px-5 py-4"
              style={{ borderColor: WEB.borderDefault }}
            >
              <div className="shrink-0 w-20">
                <PillBadge accent="purple">{row.t}</PillBadge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: WEB.textPrimary }}>
                  {row.label}
                </p>
                <p className="text-sm mt-1 leading-[1.7]" style={{ color: WEB.textMuted }}>
                  {row.body}
                </p>
              </div>
              <Clock className="w-4 h-4 shrink-0 mt-1" style={{ color: WEB.textSubtle }} />
            </div>
          ))}
        </div>
      </Card>

      <SectionLabel accent="purple">Who this is for</SectionLabel>
      <Card>
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          <div>
            <p
              className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3"
              style={{ color: WEB.purple }}
            >
              A good fit if
            </p>
            <ul className="space-y-2.5 text-[15px] leading-[1.7]" style={{ color: WEB.textBody }}>
              <li>You own or operate a local/SMB business doing $10K–$500K/mo.</li>
              <li>You have at least one repetitive, revenue-adjacent task eating your week.</li>
              <li>You want infrastructure, not a freelancer — something that keeps shipping after the call.</li>
            </ul>
          </div>
          <div>
            <p
              className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3"
              style={{ color: WEB.textSubtle }}
            >
              Not a fit if
            </p>
            <ul className="space-y-2.5 text-[15px] leading-[1.7]" style={{ color: WEB.textMuted }}>
              <li>You&apos;re looking for a one-off logo, site, or ad — we build systems, not assets.</li>
              <li>You want a pitch-deck consultation. We build during the call.</li>
              <li>You&apos;re a week from bankruptcy. AI compounds; it doesn&apos;t rescue.</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="max-w-6xl mx-auto px-5 md:px-8 mt-12 md:mt-16">
        <div
          className="rounded-2xl border p-8 md:p-12 text-center"
          style={{ backgroundColor: "#1f1230", borderColor: `${WEB.purple}33` }}
        >
          <Sparkles className="w-6 h-6 mx-auto mb-4" style={{ color: WEB.purple }} />
          <h2
            className="text-2xl md:text-3xl font-bold tracking-tight mb-3"
            style={{ color: WEB.textPrimary }}
          >
            Pick a time. Walk in. Leave with a plan.
          </h2>
          <p className="text-[15px] md:text-base max-w-lg mx-auto mb-6" style={{ color: WEB.textBody }}>
            The next 30 minutes is the cheapest way to find out whether an AI agent can pay for itself inside your business this quarter.
          </p>
          <div className="flex justify-center">
            <CtaRow
              primary={{ label: "Open scheduler", onClick: () => setOpen(true) }}
              secondary={{ label: "Read the Interlinked letter", href: "/interlinked" }}
              accent="purple"
            />
          </div>
        </div>
      </div>

      <PageFooter
        tagline="Omni AI · Interlinked"
        links={[
          { label: "Interlinked", href: "/interlinked" },
          { label: "Premium", href: "/interlinked/premium" },
          { label: "Command Center", href: "/command" },
        ]}
      />

      <BookDemoModal isOpen={open} onClose={() => setOpen(false)} />
    </PageShell>
  );
}
