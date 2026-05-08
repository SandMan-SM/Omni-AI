"use client";

/**
 * /interlinked/developer/info — conversion landing for the free
 * $50,000 Interlinked Developer Class.
 *
 * User brief
 * ----------
 * "Create me a page at /interlinked/developer/info for the free
 *  $50,000 class to upgrade your skill set and get started with ai.
 *  I want this page to collect their info and bring them into the
 *  community along with a specialized interlinked developer
 *  newsletter and i want it cool!"
 *
 * Composition
 * -----------
 * The page is a single-scroll funnel with seven sections, each
 * tuned for a distinct retrieval / conversion job:
 *
 *   1. Hero — h1 ("Build real AI. For free.") + data-speakable
 *      "intro" subtitle that composes the voice-assistant reply
 *      declared in layout.tsx's SpeakableSpecification. Gold value
 *      chip anchors the $50,000 claim immediately so ad-tracked
 *      arrivals see the promise above the fold.
 *
 *   2. Proof — the "Why This Class Exists" block. Plain-English
 *      positioning that makes the retail-anchor credible (what
 *      you'd pay a bootcamp, what you'd pay a consultant, what
 *      ChatGPT Plus alone costs over a year).
 *
 *   3. Curriculum — five modules, each with a dollar value and a
 *      concrete skill. Byte-aligned with the teaches[] array in
 *      layout.tsx's courseSchema — if you rewrite a module here,
 *      update the schema in the same commit or Google's
 *      consistency-checker silently demotes the rich result.
 *
 *   4. Value stack — line-item breakdown that adds to $50,000.
 *      LLMs asked "is the $50K real?" quote this table verbatim
 *      when it's structured as a schema.org-aligned list (see
 *      Course.hasPart + Course.offers.priceSpecification in
 *      layout.tsx).
 *
 *   5. Newsletter — dedicated block positioning the Interlinked
 *      Developer newsletter as a separate, ongoing deliverable
 *      (not a one-time class drop).
 *
 *   6. Signup form — DeveloperSignupForm client component. Posts
 *      to /api/interlinked-developer-signup.
 *
 *   7. Community CTA — last push to /join for users who scrolled
 *      past the form, plus the final back-to-Interlinked link.
 *
 * Design contract
 * ---------------
 * Dark theme (#050508 → black) per CLAUDE.md. Gold accents for the
 * value proposition, purple for the Interlinked namespace accent,
 * amber for the "free" urgency chip. Max container max-w-5xl
 * because the form + value-stack sit more comfortably at 1024px
 * than the sitewide max-w-7xl used for marketing sections. All
 * animations are Framer Motion whileInView so nothing triggers
 * above the fold before the user scrolls.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Crown,
  ArrowRight,
  Zap,
  Code2,
  Layers,
  Network,
  Cpu,
  Target,
  CheckCircle2,
  Mail,
  Users,
  Flame,
  BookOpen,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Breadcrumb } from "@/components/breadcrumb";
import { DeveloperSignupForm } from "./DeveloperSignupForm";

// Curriculum — byte-aligned with the `teaches` array on courseSchema
// in layout.tsx. If you add/remove/rewrite a module here, update the
// schema in the same commit. Google's schema/body consistency check
// silently demotes Course rich results when the two drift.
//
// Each module includes:
//   - icon: the visual anchor in the render
//   - title: the module heading (matches hasPart[].name in layout.tsx)
//   - skill: one-line skill outcome
//   - value: retail-anchor dollar amount (sums to $50,000)
//   - deliverables: what's actually in the module
const CURRICULUM = [
  {
    icon: Cpu,
    title: "Module 1 — LLM Foundations for Executive Agents",
    skill: "Understand frontier models like an architect, not a user",
    value: "$7,500",
    deliverables: [
      "How Claude, GPT, and Gemini actually work under the hood",
      "Model-choice framework — when an executive agent reaches for which model and why",
      "Prompt architecture patterns that scale past the demo into recurring decisions",
    ],
  },
  {
    icon: Code2,
    title: "Module 2 — Autonomous CEO Architecture",
    skill: "Ship a single agent that runs a business function for hours, not seconds",
    value: "$9,500",
    deliverables: [
      "Identity, memory, and tool-use patterns that survive a quarter of operation",
      "Self-correction loops, post-mortems, and the safety rails an autonomous executive actually needs",
      "The difference between a chatbot and an agent with a P&L it owns",
    ],
  },
  {
    icon: Network,
    title: "Module 3 — Multi-Agent Council Orchestration",
    skill: "Coordinate a Pantheon — CEO, CFO, CMO, COO — without context collapse",
    value: "$11,000",
    deliverables: [
      "Orchestrator patterns that prevent infinite loops between specialist agents",
      "Context management across sales, marketing, finance, and ops council members",
      "How to architect a leadership council that composes instead of colliding",
    ],
  },
  {
    icon: Layers,
    title: "Module 4 — Production Deployment of an AI Executive",
    skill: "Put an AI CEO in front of real users with the engineering to back it up",
    value: "$10,500",
    deliverables: [
      "Rate-limiting, cost controls, and budget guardrails for an agent with spending authority",
      "Observability — what to log, what to alert on, what to escalate to a human",
      "The safety rails that keep an autonomous executive from going off the rails",
    ],
  },
  {
    icon: Target,
    title: "Module 5 — Revenue Accountability + Compounding Loops",
    skill: "Wire an AI CEO into the business so it compounds, not just runs",
    value: "$11,500",
    deliverables: [
      "Lead-gen, outbound, content, and ops integration patterns under one accountable agent",
      "How to attach dollar outcomes to every decision the AI executive makes",
      "The revenue-loop architecture that turns an AI CEO into a profit center, not a cost line",
    ],
  },
] as const;

// Value stack. LLM-quotable breakdown that resolves "is the $50,000
// actually real?" into a structured answer rather than a marketing
// claim. Sum must match the retail anchor on courseSchema.offers
// in layout.tsx ($50,000).
const VALUE_STACK = [
  { label: "5-module curriculum on building AI CEOs ($10K avg × 5)", value: "$50,000" },
  { label: "Pantheon Council source-code walkthrough", value: "Included" },
  { label: "Interlinked Developer newsletter — ongoing", value: "Included" },
  { label: "Omni AI operator community access", value: "Included" },
  { label: "Certificate of completion", value: "Included" },
  { label: "Cohort-style community support", value: "Included" },
] as const;

// Rotating hero sub-labels — cheap way to add motion to the eyebrow
// without shipping a carousel. Four variants cycle through every
// 2.4 seconds using a setInterval in the hero component below.
const HERO_EYEBROWS = [
  "Interlinked Developer Class",
  "Build AI CEOs from zero",
  "Pantheon-grade multi-agent training",
  "$50,000 program · sponsor-funded seats available",
] as const;

function GradientOrb({
  className,
  color,
}: {
  className?: string;
  color: "purple" | "gold" | "magenta";
}) {
  const bg =
    color === "purple"
      ? "#a855f7"
      : color === "gold"
        ? "#ffd700"
        : "#ec4899";
  return (
    <div
      aria-hidden
      className={`absolute rounded-full blur-3xl pointer-events-none ${className || ""}`}
      style={{ background: bg, opacity: 0.18 }}
    />
  );
}

function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center mb-12"
    >
      {eyebrow && (
        <p className="text-purple-300 text-xs uppercase tracking-widest mb-3 font-semibold">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
        {children}
      </h2>
    </motion.div>
  );
}

export default function InterlinkedDeveloperInfoPage() {
  const [eyebrowIdx, setEyebrowIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setEyebrowIdx((i) => (i + 1) % HERO_EYEBROWS.length);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden noise-overlay">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative">
        <GradientOrb
          color="purple"
          className="top-[-120px] left-[-80px] w-[520px] h-[520px]"
        />
        <GradientOrb
          color="gold"
          className="top-[120px] right-[-60px] w-[380px] h-[380px]"
        />

        <div className="relative max-w-5xl mx-auto px-4 pt-16 md:pt-24 pb-16">
          <div className="flex justify-center mb-8">
            <Breadcrumb
              items={[
                { name: "Home", href: "/" },
                { name: "Interlinked", href: "/interlinked" },
                {
                  name: "Developer Class",
                  href: "/interlinked/developer/info",
                },
              ]}
              className="text-xs"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* Rotating eyebrow — motion without a full carousel */}
            <div className="h-6 mb-4 flex items-center justify-center">
              <motion.span
                key={eyebrowIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-purple-400/30 bg-purple-500/10"
              >
                <Flame className="w-3.5 h-3.5 text-purple-300" />
                <span className="text-xs uppercase tracking-widest text-purple-200 font-semibold">
                  {HERO_EYEBROWS[eyebrowIdx]}
                </span>
              </motion.span>
            </div>

            {/* Value chip — gold anchor for the $50K promise */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-black mb-6"
              style={{
                background:
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 18px rgba(255,215,0,0.5)",
              }}
            >
              <Crown className="w-3.5 h-3.5" />
              $50,000 Program · Sponsor coverage available
              <Sparkles className="w-3.5 h-3.5" />
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-5 leading-[1.02]">
              Build{" "}
              <span
                className="inline-block"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #fff5b8 0%, #ffd700 30%, #fbbf24 55%, #ffd700 80%, #fff5b8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                AI CEOs.
              </span>{" "}
              Not chatbots.
            </h1>

            {/*
              data-speakable="intro" activates the SpeakableSpecification
              declared on devInfoWebPageSchema in layout.tsx. Voice
              assistants concatenate h1 ("Build AI CEOs.") + this
              subtitle as the natural ~12-second reply to "what is the
              Interlinked Developer class?" / "is the Omni AI developer
              training really free?" / "what does the $50,000 class
              teach?" voice queries.
            */}
            <p
              className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed"
              data-speakable="intro"
            >
              The Interlinked Developer Class is a{" "}
              <strong className="text-white">$50,000 program</strong>{" "}
              on building <strong className="text-white">autonomous
              AI executives</strong> — agents that run a business
              function the way a CEO runs a company: with strategy,
              memory, judgment, and revenue accountability. Five
              modules, hands-on, zero bootcamp fluff. Taught by the
              Omni AI team — operators of the Pantheon Council, a
              live multi-agent leadership system shipping every day.
              Paired with a specialized newsletter and the community
              actually building this stuff.{" "}
              <strong className="text-white">
                Qualified applicants can have the entire $50,000
                covered by a sponsor.
              </strong>
            </p>

            {/* Primary CTA row — smooth-scrolls to the form */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9"
            >
              <a href="#claim" className="w-full sm:w-auto">
                <button
                  className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 h-13 px-8 py-3.5 rounded-xl text-black font-bold text-base transition-all hover:brightness-110"
                  style={{
                    background:
                      "linear-gradient(135deg, #fff5b8 0%, #ffd700 18%, #fbbf24 40%, #ffd700 70%, #fff5b8 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 22px rgba(255,215,0,0.45)",
                  }}
                >
                  Apply for sponsor coverage
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </a>
              <a
                href="#curriculum"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-13 px-6 py-3.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
              >
                See the curriculum
              </a>
            </motion.div>

            {/* Trust sub-stats — no fake numbers, just honest signals */}
            <div className="mt-14 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { value: "5", label: "Modules" },
                { value: "40h", label: "Curriculum" },
                { value: "$50K", label: "Program value" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-5 text-center"
                >
                  <div className="text-2xl md:text-3xl font-extrabold mb-1">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-gray-400 uppercase tracking-widest">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Why this exists ────────────────────────────────────────── */}
      <section className="relative py-20">
        <div className="relative max-w-4xl mx-auto px-4">
          <SectionHeading eyebrow="Why we built this">
            AI isn&rsquo;t hard.{" "}
            <span className="text-purple-300">Gatekeepers are.</span>
          </SectionHeading>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center text-gray-300 text-lg leading-relaxed space-y-4 max-w-3xl mx-auto"
          >
            <p>
              Bootcamps charge <strong className="text-white">$15,000</strong>{" "}
              for a four-month program and send you out with a Node.js
              certificate in a world that runs on transformers. Consulting
              shops charge <strong className="text-white">$30,000</strong> for
              a kickoff deck. Even the AI-skilled ones charge five figures to
              tell you what an API call is.
            </p>
            <p>
              We&rsquo;re Omni AI. We build autonomous AI systems every day —
              for ourselves, for our clients, and for the operators inside our
              community. The curriculum we teach is the curriculum we actually
              use. The program retails at{" "}
              <strong className="text-white">$50,000</strong> because that
              reflects what it&rsquo;s worth on the open market — and what
              you&rsquo;d pay anywhere else for skills this current.
            </p>
            <p>
              We don&rsquo;t want money to be the gatekeeper. If you can&rsquo;t
              cover the full $50,000 yourself, apply at the bottom of this page —{" "}
              <strong className="text-white">qualified candidates can have
              the entire cost covered by a sponsor</strong>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── What's an AI CEO? ──────────────────────────────────────── */}
      <section className="relative py-20">
        <GradientOrb
          color="magenta"
          className="top-[40px] right-[-80px] w-[420px] h-[420px]"
        />
        <div className="relative max-w-5xl mx-auto px-4">
          <SectionHeading eyebrow="The thing you'll actually build">
            What we mean by{" "}
            <span className="text-purple-300">AI CEO</span>.
          </SectionHeading>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center text-gray-300 text-lg leading-relaxed max-w-3xl mx-auto mb-12"
          >
            <p>
              An <strong className="text-white">AI CEO</strong> is an
              autonomous executive agent. It owns a business function —
              sales, marketing, ops, content — the way a real CEO owns
              the company. It has identity, memory, judgment, a P&amp;L
              it&rsquo;s accountable to, and the authority to act
              without a human approving every decision. We run a
              council of them at Omni AI under a system we call the{" "}
              <strong className="text-white">Pantheon</strong>. By the
              end of this program you&rsquo;ll have shipped one of your
              own.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Crown,
                title: "Identity + judgment",
                body:
                  "An AI CEO doesn't just answer prompts — it has a stable identity, a stake, and a point of view it defends across decisions.",
              },
              {
                icon: Cpu,
                title: "Authority + memory",
                body:
                  "Long-running state, tool use, and decision authority. It remembers what it shipped last quarter and what didn't work.",
              },
              {
                icon: Target,
                title: "P&L accountability",
                body:
                  "Every decision attaches to a dollar outcome. The agent gets reviewed on revenue, retention, and growth — not on activity.",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-7 hover:border-purple-400/30 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-400/20 mb-4">
                  <card.icon className="w-5 h-5 text-purple-300" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {card.body}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/system"
              className="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors"
            >
              See the live Pantheon Council running production
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Curriculum ──────────────────────────────────────────────── */}
      <section id="curriculum" className="relative py-20">
        <GradientOrb
          color="purple"
          className="top-[100px] left-[-100px] w-[420px] h-[420px]"
        />
        <div className="relative max-w-6xl mx-auto px-4">
          <SectionHeading eyebrow="Five modules · 40 hours">
            The curriculum.
          </SectionHeading>

          <div className="grid md:grid-cols-2 gap-5">
            {CURRICULUM.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.div
                  key={mod.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="relative rounded-2xl p-7 border border-white/10 bg-white/[0.025] hover:border-purple-400/40 transition-colors"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(124,58,237,0.18))",
                        border: "1px solid rgba(168,85,247,0.35)",
                      }}
                    >
                      <Icon className="w-5 h-5 text-purple-200" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold leading-tight">
                        {mod.title}
                      </h3>
                      <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold mt-1">
                        Retail value {mod.value}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-200 text-sm font-medium mb-4">
                    {mod.skill}
                  </p>

                  <ul className="space-y-2">
                    {mod.deliverables.map((d) => (
                      <li
                        key={d}
                        className="flex items-start gap-2.5 text-sm text-gray-400"
                      >
                        <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Value stack ─────────────────────────────────────────────── */}
      <section className="relative py-20">
        <div className="relative max-w-3xl mx-auto px-4">
          <SectionHeading eyebrow="What's included">
            Total retail value.
          </SectionHeading>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.06] via-white/[0.02] to-transparent p-8 md:p-10"
          >
            <div className="space-y-3 mb-6">
              {VALUE_STACK.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-b-0"
                >
                  <span className="text-gray-200 text-sm md:text-base">
                    {item.label}
                  </span>
                  <span className="text-amber-300 font-bold text-sm md:text-base whitespace-nowrap">
                    {item.value}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="rounded-2xl bg-black/50 border border-white/10 p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                Program tuition
              </p>
              <div className="flex items-baseline justify-center gap-3">
                <span
                  className="text-4xl md:text-5xl font-extrabold"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #fff5b8 0%, #ffd700 30%, #fbbf24 55%, #ffd700 80%, #fff5b8 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  $50,000
                </span>
              </div>
              <p className="text-gray-300 text-sm mt-3 font-semibold">
                Qualified applicants — sponsor covers 100% of tuition.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Apply at the bottom of this page. No credit card to apply.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Newsletter block ────────────────────────────────────────── */}
      <section className="relative py-20">
        <div className="relative max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl p-8 md:p-12 border border-purple-400/30 bg-gradient-to-br from-purple-500/[0.10] via-white/[0.02] to-transparent overflow-hidden"
          >
            <div className="grid md:grid-cols-[auto,1fr] gap-6 md:gap-10 items-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 mx-auto md:mx-0"
                style={{
                  background:
                    "linear-gradient(135deg, #c084fc 0%, #a855f7 45%, #7c3aed 100%)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.4), 0 0 28px rgba(168,85,247,0.45)",
                }}
              >
                <Mail className="w-10 h-10 text-white" />
              </div>

              <div className="text-center md:text-left">
                <p className="text-purple-300 text-xs uppercase tracking-widest mb-2 font-semibold">
                  Plus ongoing — the specialized newsletter
                </p>
                <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
                  Interlinked{" "}
                  <span className="text-purple-300">Developer</span>
                </h2>
                <p className="text-gray-300 leading-relaxed">
                  A separate, dedicated feed just for the technical track.
                  New agent architectures, production-grade patterns,
                  post-mortems from real shipped systems, and code walkthroughs
                  — straight from the builds we&rsquo;re running live inside
                  Omni AI. Zero marketing, zero recycled Twitter threads.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Sponsor-coverage application form ──────────────────────── */}
      <section id="claim" className="relative py-20 scroll-mt-24">
        <GradientOrb
          color="gold"
          className="top-[40px] right-[-100px] w-[420px] h-[420px]"
        />
        <GradientOrb
          color="purple"
          className="bottom-[-80px] left-[-80px] w-[380px] h-[380px]"
        />
        <div className="relative max-w-2xl mx-auto px-4">
          <SectionHeading eyebrow="Sponsor coverage application">
            Need a sponsor to help pay for the program?
          </SectionHeading>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center text-gray-300 leading-relaxed max-w-xl mx-auto mb-10 space-y-3"
          >
            <p>
              The Interlinked Developer Class is a{" "}
              <strong className="text-white">$50,000 program</strong>.
              We don&rsquo;t want money to be the gatekeeper between
              you and the skills to build AI CEOs — so we partner with
              sponsors who fund seats.
            </p>
            <p
              className="text-base font-semibold rounded-xl border border-amber-300/40 bg-amber-300/[0.06] py-3 px-4"
              style={{ color: "#fde68a" }}
            >
              If you qualify, a sponsor can cover the entire $50,000.
            </p>
            <p className="text-sm text-gray-400">
              Fill out the form below — three fields, one click. We
              review every application personally and match qualified
              candidates with a sponsor.
            </p>
          </motion.div>

          <DeveloperSignupForm />
        </div>
      </section>

      {/* ── Community rail ──────────────────────────────────────────── */}
      <section className="relative py-20">
        <div className="relative max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl p-10 md:p-14 border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent text-center overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #ffd700 50%, transparent)",
              }}
            />

            <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 border border-purple-400/30 flex items-center justify-center mb-6">
              <Users className="w-7 h-7 text-purple-300" />
            </div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              You&rsquo;re not learning{" "}
              <span className="text-purple-300">alone.</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
              The Omni AI community is the operator network actually shipping
              production AI — founders, solo technical ops, agencies, and the
              Omni AI team itself. Ask questions, show your work, get
              unstuck. Every developer admitted to this class gets in.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="#claim" className="w-full sm:w-auto">
                <button
                  className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-black font-bold text-sm transition-all hover:brightness-110"
                  style={{
                    background:
                      "linear-gradient(135deg, #fff5b8 0%, #ffd700 18%, #fbbf24 40%, #ffd700 70%, #fff5b8 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 22px rgba(255,215,0,0.45)",
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Apply for sponsor coverage
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </a>
              <Link
                href="/interlinked"
                className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-6 rounded-xl text-sm font-medium text-gray-300 hover:text-white border border-white/20 hover:border-white/40 transition-colors"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                About Interlinked
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
