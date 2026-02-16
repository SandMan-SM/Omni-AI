import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Mail, Shield, Brain, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookDemoModal } from "@/components/book-demo-modal";
import { WebinarRegistrationModal } from "@/components/webinar-registration-modal";

function getSecondSaturday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const firstDayOfWeek = first.getDay();
  const firstSaturday = firstDayOfWeek <= 6 ? (6 - firstDayOfWeek + 1) : 1;
  const secondSaturday = firstSaturday + 7;
  return new Date(year, month, secondSaturday);
}

function getNextSessionDate(): Date {
  const now = new Date();
  const candidates: Date[] = [];

  for (let offset = 0; offset < 6; offset++) {
    const monthOffset = now.getMonth() + offset;
    const month = monthOffset % 12;
    const y = now.getFullYear() + Math.floor(monthOffset / 12);

    const secondSat = getSecondSaturday(y, month);
    secondSat.setHours(18, 0, 0, 0);
    if (secondSat > now) candidates.push(secondSat);

    const eleventh = new Date(y, month, 11, 12, 0, 0, 0);
    if (eleventh > now) candidates.push(eleventh);

    const twentyEighth = new Date(y, month, 28, 19, 0, 0, 0);
    if (twentyEighth > now) candidates.push(twentyEighth);

    if (candidates.length > 0) break;
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] || new Date();
}

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
          className="flex items-start gap-3"
        >
          <Icon className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
          <span className="text-gray-300">{item}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function CTAButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="flex justify-center py-8"
    >
      <Button
        onClick={onClick}
        className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white text-lg px-10 py-7 rounded-md neon-glow"
        data-testid="button-cta-register"
      >
        {label}
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </motion.div>
  );
}

export default function Interlinked() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <a href="/" className="inline-block mb-8" data-testid="link-home">
            <span className="text-2xl font-bold text-gradient">Omni AI</span>
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
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-3">Online Training Starts In</p>
          <CountdownTimer />
          <p className="text-xl md:text-2xl font-bold mt-4 text-white leading-tight">
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
            It's built specifically for me. It's connected to my Gmail, ad accounts, accounting software, calendar, analytics, payroll, team systems — everything.
          </p>
          <p className="text-purple-400 font-semibold text-lg">One central brain.</p>
          <p className="text-gray-400 leading-relaxed">
            And in this free training, I'm going to show you how to build the exact same system for your business using OMNI Leads.
          </p>
        </motion.div>

        <CTAButton label="Grab Your Free Spot" onClick={() => setIsRegistrationOpen(true)} />

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
            Then you'll see how to implement the same structure inside your company.
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
          <p className="text-gray-400">But they're terrified of the operational headache.</p>
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
          <p className="text-purple-400 font-semibold">OMNI Leads was built to eliminate that chaos.</p>
          <p className="text-white font-bold text-lg">This is your escape route.</p>
        </motion.div>

        <div className="border-t border-white/5 my-12" />

        <SectionHeading>In This Free Webinar, I'll Reveal:</SectionHeading>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-8 mb-8 border border-white/5"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Why ChatGPT Isn't Enough
          </h3>
          <p className="text-gray-400 mb-4">
            There's a massive difference between "glorified search AI" and a true AI CEO.
          </p>
          <p className="text-gray-400 mb-4">Most tools wait for you to ask questions.</p>
          <p className="text-gray-300 mb-3">A real AI CEO:</p>
          <BulletList items={[
            "Remembers everything about your business",
            "Monitors it 24/7",
            "Connects across systems",
            "Alerts you to problems before you see them",
            "Surfaces opportunities automatically",
          ]} />
          <p className="text-purple-400 font-semibold mt-4">That's what we built inside OMNI Leads.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-8 mb-12 border border-white/5"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
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
            If you're already operating at scale and want to see how OMNI Leads would integrate directly into your business:
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
            Business owners using structured AI frameworks like the one inside OMNI Leads have:
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
            Claim your seat in this free training and see how to implement a centralized AI CEO inside your business.
          </p>
        </motion.div>

        <CTAButton label="Grab Your Free Spot" onClick={() => setIsRegistrationOpen(true)} />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="glass-card rounded-md p-6 mb-12 text-center neon-border"
        >
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-3">Online Training Starts In</p>
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
          <p className="text-gray-300">I'm the founder of OMNI Leads.</p>
          <p className="text-gray-400 leading-relaxed">
            I've built and scaled multiple businesses, generated significant revenue across industries, and spent millions in paid advertising testing what actually works.
          </p>
          <p className="text-gray-400 leading-relaxed">Through that process, I realized something:</p>
          <p className="text-purple-400 font-semibold">
            The bottleneck in every growing business is decision-making and operational visibility.
          </p>
          <p className="text-gray-400 leading-relaxed">So I built a centralized AI system to solve it.</p>
          <p className="text-gray-400 leading-relaxed">Now I'm showing you how to do the same.</p>
          <p className="text-gray-400 leading-relaxed">
            In this free training, I'll walk you through the roadmap I would use to build and scale a business today using AI leverage from day one.
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
              Earnings and income representations made by OMNI Leads and its representatives are aspirational statements only of your earnings potential.
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
              OMNI Leads and its representatives are not responsible for your actions. You are solely responsible for your business decisions and implementation.
            </p>
            <p>All strategies and systems shared should be evaluated through your own due diligence.</p>
            <p>
              OMNI Leads may receive compensation for recommending certain products or services. If you prefer not to purchase through affiliate relationships, you may independently search for the same resources.
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
            If you have questions about OMNI Leads or whether this training is right for you, contact support and we'll help clarify your next steps.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-gray-500">
              Support: <a href="mailto:support@omnileads.com" className="text-purple-400 hover:text-purple-300 transition-colors">support@omnileads.com</a>
            </span>
            <span className="text-gray-500">
              Legal: <a href="mailto:legal@omnileads.com" className="text-purple-400 hover:text-purple-300 transition-colors">legal@omnileads.com</a>
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
          <p className="text-white font-bold text-lg mb-2">Reserve your seat now.</p>
          <p className="text-gray-400 mb-1">OMNI Leads isn't about working harder.</p>
          <p className="text-purple-400 font-semibold text-lg">It's about building an AI CEO that works for you.</p>
        </motion.div>

        <CTAButton label="Grab Your Free Spot" onClick={() => setIsRegistrationOpen(true)} />

        <div className="text-center py-8 border-t border-white/5 mt-8">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Omni Leads LLC
          </p>
        </div>
      </div>

      <BookDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
      <WebinarRegistrationModal
        isOpen={isRegistrationOpen}
        onClose={() => setIsRegistrationOpen(false)}
      />
    </div>
  );
}
