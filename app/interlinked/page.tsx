"use client";

// Marketing page — pure client component. Countdown state lives in
// useEffect on the client, so the shell can be statically prerendered
// and edge-cached. No server data.

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Mail, Shield, Brain, Zap, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookDemoModal } from "@/components/modals/lazy";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { Breadcrumb } from "@/components/breadcrumb";
// Shared with layout.tsx so the countdown and the Event JSON-LD schema
// always announce the same startDate — previously the function lived only
// here on the client, so the server-side Event schema couldn't quote it.
import { getNextSessionDate } from "./next-session";

function CountdownTimer() {
  const nextSession = useMemo(() => getNextSessionDate(), []);

  const [remaining, setRemaining] = useState(() => {
    const diff = Math.max(0, Math.floor((nextSession.getTime() - Date.now()) / 1000));
    return diff;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((nextSession.getTime() - Date.now()) / 1000));
      setRemaining(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextSession]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex items-center justify-center gap-4" data-testid="countdown-timer">
      <Clock className="w-5 h-5 text-purple-400" />
      <div className="flex items-center gap-1 font-mono text-lg md:text-xl">
        {days > 0 && (
          <>
            <span className="text-white font-bold">{days}</span>
            <span className="text-gray-500 text-sm mr-2">d</span>
          </>
        )}
        <span className="text-white font-bold">{String(hours).padStart(2, "0")}</span>
        <span className="text-purple-400">:</span>
        <span className="text-white font-bold">{String(minutes).padStart(2, "0")}</span>
        <span className="text-purple-400">:</span>
        <span className="text-white font-bold">{String(seconds).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="text-3xl md:text-4xl font-bold mb-6"
    >
      <span className="text-gradient">{children}</span>
    </motion.h2>
  );
}

function BulletList({ items, icon: Icon = CheckCircle }: { items: string[]; icon?: React.ElementType }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          viewport={{ once: true }}
          className="flex items-start gap-4"
        >
          <Icon className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
          <span className="text-gray-300">{item}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function NewsletterSignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "interlinked" }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        reactivated?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload?.error || "We couldn't save your email. Please try again.");
      }

      setStatus("success");
      setEmail("");
      setMessage(
        payload?.reactivated
          ? "Welcome back — you're back on the Interlinked list."
          : "You're in. Watch your inbox for the next Interlinked update.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We couldn't save your email. Please try again.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="py-8"
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-md border border-purple-500/30 bg-white/[0.04] p-4 shadow-[0_0_40px_rgba(124,58,237,0.18)] sm:flex-row"
        data-testid="form-interlinked-newsletter"
      >
        <label htmlFor="interlinked-newsletter-email" className="sr-only">
          Email address for Interlinked newsletter updates
        </label>
        <input
          id="interlinked-newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          className="min-h-14 flex-1 rounded-md border border-white/10 bg-white/[0.08] px-4 text-base text-white placeholder:text-gray-500 outline-none transition-colors focus:border-purple-400 focus:bg-white/[0.12]"
          data-testid="input-interlinked-newsletter-email"
        />
        <Button
          type="submit"
          disabled={status === "loading"}
          className="min-h-14 shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 px-6 text-base font-semibold text-white neon-glow disabled:cursor-not-allowed disabled:opacity-70"
          data-testid="button-interlinked-newsletter-submit"
        >
          {status === "loading" ? "Subscribing..." : "Stay Updated"}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </form>
      {message && (
        <p
          className={`mt-3 text-center text-sm ${status === "success" ? "text-emerald-300" : "text-red-300"}`}
          role="status"
        >
          {message}
        </p>
      )}
      <p className="mt-3 text-center text-xs text-gray-500">
        Get the Interlinked operator notes and Omni AI build updates. No spam.
      </p>
    </motion.div>
  );
}

export default function Interlinked() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen text-white noise-overlay">
      <CursorSpotlight />
      <Navbar 
        onBookDemo={() => setIsDemoModalOpen(true)} 
        onSignIn={() => {}}
      />
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20 pt-16 md:pt-20">

        {/* Visible breadcrumb — pairs with breadcrumbSchema in the
            layout so Google renders the SERP breadcrumb chip and deep-
            landing visitors (email CTAs, social shares from the Event
            rich result) get a one-click parent path back to the homepage.
            Wrapped in a flex-justify-center shell because the Breadcrumb
            component's className applies to its nav, not the inner ol —
            centering the list requires the outer container. Tiny text +
            centered so it fits the existing hero composition without
            disrupting the countdown's vertical rhythm. */}
        <div className="flex justify-center mb-6">
          <Breadcrumb
            items={[
              { name: "Home", href: "/" },
              { name: "Interlinked", href: "/interlinked" },
            ]}
            className="text-xs"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <a href="/" className="inline-flex items-center gap-2 px-3 md:px-4 py-2 mb-6 md:mb-8 rounded-full glass-card neon-border" data-testid="link-home">
            <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-purple-400 flex-shrink-0" />
            <span className="text-xs md:text-sm text-gray-300 whitespace-nowrap">Omni AI introducing Interlinked</span>
          </a>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gradient">INTERLINKED</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="glass-card rounded-md p-6 mb-12 text-center neon-border"
        >
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">Online Training Starts In</p>
          <CountdownTimer />
          {/* data-speakable="intro" activates the SpeakableSpecification
              declared on the Event + Course JSON-LD in
              app/interlinked/layout.tsx. Voice assistants concatenate
              h1 ("INTERLINKED") + this tagline as the natural ~8-second
              reply to "what is Interlinked?" / "when's the next Omni AI
              training?" voice queries, quoting the tagline verbatim as
              the primary hook. */}
          <p
            className="text-xl md:text-2xl font-bold mt-4 text-white leading-tight"
            data-speakable="intro"
          >
            Your Own Private AI CEO Will Run Your Business While You Sleep
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="space-y-6 mb-12"
        >
          <p className="text-xl text-gray-300 font-medium">Forget about generic AI tools.</p>
          <p className="text-gray-400 leading-relaxed">
            My private AI runs my businesses while I work just 4 focused hours a day instead of 8.
          </p>
          <p className="text-gray-400 leading-relaxed">
            It&apos;s built specifically for me. It&apos;s connected to my Gmail, ad accounts, accounting software, calendar, analytics, payroll, team systems — everything.
          </p>
          <p className="text-purple-400 font-semibold text-lg">One central brain.</p>
          <p className="text-gray-400 leading-relaxed">
            And in this free training, I&apos;m going to show you how to build the exact same system for your business using Omni AI.
          </p>
        </motion.div>

        <NewsletterSignupForm />

        <div className="border-t border-white/5 my-12" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="space-y-6 mb-12"
        >
          <p className="text-gray-300 leading-relaxed">
            You need to see how an entrepreneur who has generated hundreds of millions in revenue built a centralized AI brain that monitors his entire business 24/7:
          </p>
          <BulletList items={[
            "Emails",
            "Finances",
            "Team performance",
            "Advertising",
            "Calendar",
            "Forecasting",
            "Operational risk",
          ]} />
          <p className="text-gray-400 leading-relaxed">
            Then you&apos;ll see how to implement the same structure inside your company.
          </p>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>Why Most Entrepreneurs Stay Stuck</SectionHeading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="space-y-6 mb-12"
        >
          <p className="text-gray-300">Most business owners want to grow.</p>
          <p className="text-gray-400">But they&apos;re terrified of the operational headache.</p>
          <p className="text-gray-400">More revenue usually means:</p>
          <BulletList
            icon={AlertTriangle}
            items={[
              "More employees",
              "More problems",
              "More dashboards",
              "More complexity",
              "More stress",
            ]}
          />
          <p className="text-purple-400 font-semibold">Omni AI was built to eliminate that chaos.</p>
          <p className="text-white font-bold text-lg">This is your escape route.</p>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>In This Free Webinar, I&apos;ll Reveal:</SectionHeading>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-8 mb-8 border border-white/5"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Why ChatGPT Isn&apos;t Enough
          </h3>
          <p className="text-gray-400 mb-4">
            There&apos;s a massive difference between &ldquo;glorified search AI&rdquo; and a true AI CEO.
          </p>
          <p className="text-gray-400 mb-4">Most tools wait for you to ask questions.</p>
          <p className="text-gray-300 mb-4">A real AI CEO:</p>
          <BulletList items={[
            "Remembers everything about your business",
            "Monitors it 24/7",
            "Connects across systems",
            "Alerts you to problems before you see them",
            "Surfaces opportunities automatically",
          ]} />
          <p className="text-purple-400 font-semibold mt-4">That&apos;s what we built inside Omni AI.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-8 mb-12 border border-white/5"
        >
          <h3 className="text-xl font-bold text-white mb-4">
            The AI CEO That Thinks About Your Business Constantly
          </h3>
          <p className="text-gray-400 mb-4">I built a centralized AI brain connected to:</p>
          <BulletList items={[
            "Gmail",
            "Google Calendar",
            "Slack",
            "Accounting software",
            "Ad platforms",
            "Analytics",
            "Payroll systems",
            "CRM tools",
            "Internal dashboards",
          ]} />
          <p className="text-gray-300 mt-4">
            So one AI monitors everything while I sleep, travel, or focus on growth.
          </p>
          <p className="text-gray-400 mt-2">
            No more manually checking dashboards. No more reactive management. No more decision fatigue.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-8 mb-12 neon-border text-center"
        >
          <p className="text-gray-300 mb-4">
            If you&apos;re already operating at scale and want to see how Omni AI would integrate directly into your business:
          </p>
          <Button
            onClick={() => setIsDemoModalOpen(true)}
            variant="outline"
            className="border-purple-500/50 text-white text-lg px-8 py-6"
            data-testid="button-book-demo-mid"
          >
            Book a Free Demo
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>Why Missing This Trend Is Different</SectionHeading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="space-y-6 mb-12"
        >
          <p className="text-gray-400">Missing past trends may have cost people upside.</p>
          <p className="text-gray-300 font-medium">
            Missing AI at the operational level will cost business owners speed, leverage, and competitive advantage.
          </p>
          <p className="text-gray-400">Companies that integrate AI deeply will:</p>
          <BulletList items={[
            "Move faster",
            "Cut inefficiencies",
            "Increase margins",
            "Scale without bloating payroll",
            "Outperform slower competitors",
          ]} />
          <p className="text-purple-400 font-semibold">This is about leverage.</p>
          <p className="text-white font-bold">And leverage compounds.</p>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>This Webinar Is For Business Owners Who:</SectionHeading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <BulletList items={[
            "Are currently doing 7 or 8 figures in revenue",
            "Want to grow WITHOUT hiring layers of management",
            "Are tired of manually checking reports",
            "Want better decisions with less effort",
            "Want 10x impact without 10x stress",
          ]} />
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>What Others Have Experienced</SectionHeading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="space-y-6 mb-12"
        >
          <p className="text-gray-400">
            Business owners using structured AI frameworks like the one inside Omni AI have:
          </p>
          <BulletList items={[
            "Dramatically increased operational clarity",
            "Identified hidden revenue leaks",
            "Improved ad performance",
            "Reduced wasted spend",
            "Increased executive-level focus",
          ]} />
          <p className="text-gray-500 text-sm italic mt-4">
            (Individual results always vary based on execution, industry, and market conditions.)
          </p>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>What Are You Waiting For?</SectionHeading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-4"
        >
          <p className="text-gray-300 text-lg">
            Join the Interlinked newsletter to stay updated on the AI CEO playbook, operator notes, and upcoming Omni AI training.
          </p>
        </motion.div>

        <NewsletterSignupForm />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-6 mb-12 text-center neon-border"
        >
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">Online Training Starts In</p>
          <CountdownTimer />
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>Who Am I?</SectionHeading>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="space-y-4 mb-12"
        >
          <p className="text-gray-300">I&apos;m the founder of Omni AI.</p>
          <p className="text-gray-400 leading-relaxed">
            I&apos;ve built and scaled multiple businesses, generated significant revenue across industries, and spent millions in paid advertising testing what actually works.
          </p>
          <p className="text-gray-400 leading-relaxed">Through that process, I realized something:</p>
          <p className="text-purple-400 font-semibold">
            The bottleneck in every growing business is decision-making and operational visibility.
          </p>
          <p className="text-gray-400 leading-relaxed">So I built a centralized AI system to solve it.</p>
          <p className="text-gray-400 leading-relaxed">Now I&apos;m showing you how to do the same.</p>
          <p className="text-gray-400 leading-relaxed">
            In this free training, I&apos;ll walk you through the roadmap I would use to build and scale a business today using AI leverage from day one.
          </p>
          <p className="text-white font-medium">
            This is practical. This is implementable. And this is built for serious operators.
          </p>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h3 className="text-lg font-semibold text-gray-400 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-500" />
            Important Earnings & Legal Disclaimer
          </h3>
          <div className="text-gray-500 text-sm space-y-3 leading-relaxed">
            <p>
              Earnings and income representations made by Omni AI and its representatives are aspirational statements only of your earnings potential.
            </p>
            <p>
              The success examples shared in this training are exceptional, non-typical results and are not guarantees that you will achieve the same results.
            </p>
            <p>Individual results will vary and depend on your:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Work ethic</li>
              <li>Business skills</li>
              <li>Experience</li>
              <li>Industry</li>
              <li>Market conditions</li>
              <li>Execution</li>
              <li>Economic factors</li>
              <li>Risk tolerance</li>
            </ul>
            <p>
              Omni AI and its representatives are not responsible for your actions. You are solely responsible for your business decisions and implementation.
            </p>
            <p>All strategies and systems shared should be evaluated through your own due diligence.</p>
            <p>
              Omni AI may receive compensation for recommending certain products or services. If you prefer not to purchase through affiliate relationships, you may independently search for the same resources.
            </p>
          </div>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-400" />
            Questions?
          </h3>
          <p className="text-gray-400 mb-4">
            If you have questions about Omni AI or whether this training is right for you, contact support and we&apos;ll help clarify your next steps.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-gray-500">
              Support: <a href="mailto:support@omni.ai" className="text-purple-400 hover:text-purple-300 transition-colors">support@omni.ai</a>
            </span>
            <span className="text-gray-500">
              Legal: <a href="mailto:legal@omni.ai" className="text-purple-400 hover:text-purple-300 transition-colors">legal@omni.ai</a>
            </span>
          </div>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <SectionHeading>Final Call</SectionHeading>
          <p className="text-gray-400 mb-2">Online training begins shortly.</p>
          <p className="text-gray-300 mb-1">If you want to scale intelligently instead of chaotically...</p>
          <p className="text-gray-300 mb-4">If you want leverage instead of burnout...</p>
          <p className="text-white font-bold text-lg mb-2">Stay updated as Interlinked evolves.</p>
          <p className="text-gray-400 mb-1">Omni AI isn&apos;t about working harder.</p>
          <p className="text-purple-400 font-semibold text-lg">It&apos;s about building an AI CEO that works for you.</p>
        </motion.div>

        <NewsletterSignupForm />
      </div>

      <Footer />
      <BookDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </div>
  );
}
