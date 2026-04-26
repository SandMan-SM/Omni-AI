"use client";
export const dynamic = 'force-dynamic';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield, Lock, Users, Database, Key, AlertTriangle,
  CheckCircle, Eye, Settings, ArrowLeft, Crown, Zap,
  Bot, Brain, Sparkles, Send, Inbox, Target, Calendar, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";

const omniAiHow = [
  {
    icon: Target,
    title: "1 · Find",
    color: "text-emerald-400",
    desc: "Drop a domain, paste a CSV, or describe your ideal customer. The system finds matching prospects from web sources, enriches them with company-level intelligence (size, tech, funding, growth signals), and adds them to your pipeline.",
  },
  {
    icon: Brain,
    title: "2 · Score",
    color: "text-purple-400",
    desc: "Each lead is scored 0-100 by an AI fit predictor that compares title authority, company stage, industry alignment, reachability, and buying signals against your closed-won history. Hot leads bubble to the top automatically.",
  },
  {
    icon: Sparkles,
    title: "3 · Personalize",
    color: "text-blue-400",
    desc: "For every lead, an AI writer drafts a 3-touch email sequence (day 0, +3, +7) plus a LinkedIn DM and a 15-second voicemail script. Personalization uses real signals — company keywords, tech stack, recent funding — never generic templates.",
  },
  {
    icon: Send,
    title: "4 · Send",
    color: "text-cyan-400",
    desc: "Sequences send automatically Mon–Fri 8am–6pm PT, capped at 25 per tick to protect deliverability. A built-in domain warmup curve grows daily volume from 20 → 200 over 30 days. Open / click / reply tracking is real-time.",
  },
  {
    icon: Inbox,
    title: "5 · Triage",
    color: "text-yellow-400",
    desc: "When prospects reply, an AI triager tags each message in 9 buckets (interested, meeting_booked, question, not_now, unsubscribe, wrong_person, referral, spam, other) and drafts a contextual response. Unsubscribes are auto-honored and added to the suppression list.",
  },
  {
    icon: Calendar,
    title: "6 · Book",
    color: "text-orange-400",
    desc: "Native scheduler — replaces external booking tools. Each prospect can pick a 15-min slot from your calendar via a public link. Booked leads are auto-promoted to ‘qualified’ and a confirmation email goes out instantly.",
  },
  {
    icon: Bot,
    title: "7 · Autopilot",
    color: "text-red-400",
    desc: "When you flip the switch, the agent runs the entire loop unattended every hour: scan new leads → generate outreach → schedule sequences → categorize replies → draft responses. Configurable thresholds (min score, max leads/run) keep you in control.",
  },
  {
    icon: Activity,
    title: "8 · Coach + Report",
    color: "text-pink-400",
    desc: "An AI sales coach surfaces the day’s highest-leverage actions every hour. Daily digests email at 6 PM PT. Monday mornings, a 4-paragraph weekly retro lands in your inbox grading lead volume / engagement / conversion / revenue.",
  },
];

const sections = [
  {
    icon: Shield,
    title: "Admin Privileges",
    color: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    items: [
      "Full read/write access to all user profiles and accounts",
      "Access to the Newsletter Studio — send, schedule, and manage subscriber lists",
      "Ability to toggle user subscription tiers (Free ↔ Premium)",
      "Import and export subscriber CSVs",
      "Generate Stripe payment links for premium subscriptions",
      "View and manage all demo bookings across accounts",
      "Access to the Admin Panel at /admin",
    ],
  },
  {
    icon: Lock,
    title: "Security Standards",
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    items: [
      "Never share admin credentials — the $Mafi account is sole admin",
      "Do not modify user data without explicit authorization from the account owner",
      "Admin sessions expire — always sign out when leaving a shared environment",
      "Do not expose Stripe secret keys, Resend API keys, or Telegram bot tokens",
      "All admin actions are logged — operate with accountability",
    ],
  },
  {
    icon: Users,
    title: "User Management Standards",
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/5",
    items: [
      "CPS account: campaigns are custom — do not override or delete their assigned campaigns",
      "Fray account: VIP Sponsor — handle with care, sponsor perks must remain intact",
      "Standard users: tier upgrades should be done via Stripe, not manual overrides",
      "Never delete a user account unless explicitly instructed",
      "Newsletter unsubscribes must be honored immediately",
    ],
  },
  {
    icon: Database,
    title: "Database & Infrastructure",
    color: "text-green-400",
    border: "border-green-500/20",
    bg: "bg-green-500/5",
    items: [
      "Supabase is the primary database — migrations run in the SQL editor",
      "Always run migrations in order (001 → 013+) — never skip",
      "The newsletter cron fires daily at 8am ET via Vercel Cron",
      "CRON_SECRET must match both vercel.json and Vercel environment variables",
      "Resend handles email delivery — monitor bounce rates in the Resend dashboard",
    ],
  },
  {
    icon: Key,
    title: "Environment Variables Required",
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    items: [
      "ANTHROPIC_API_KEY — AI content generation for daily newsletter",
      "TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID — Telegram delivery",
      "RESEND_API_KEY + NEWSLETTER_FROM_EMAIL — email delivery",
      "STRIPE_SECRET_KEY — payment link generation",
      "CRON_SECRET — secures the /api/cron/newsletter endpoint",
      "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY — database",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Do Not Do",
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    items: [
      "Do not force-push to main without reviewing build logs",
      "Do not run destructive SQL (DROP TABLE, TRUNCATE) in production",
      "Do not bulk-delete newsletter subscribers without a backup CSV",
      "Do not modify the Fray or CPS profile tiers without authorization",
      "Do not expose admin routes to non-admin accounts",
    ],
  },
];

export default function AdminInfo() {
  const { user, loading } = useAuth();
  const { isAdmin, profileLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profileLoading && (!user || !isAdmin)) {
      router.push("/dashboard");
    }
  }, [user, isAdmin, loading, profileLoading, router]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <CursorSpotlight />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white gap-2 px-2"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">Admin Debrief</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3 pb-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm mb-2">
            <Shield className="w-3.5 h-3.5" />
            Confidential — Admin Only
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Admin Privileges & Standards
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
            This document outlines what the $Mafi admin account can access, the standards expected,
            and the critical infrastructure details for the Omni AI platform.
          </p>
        </motion.div>

        {/* ─── How Omni AI Works ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-purple-500/[0.04] to-blue-500/[0.04] p-6 sm:p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300">
                Agentic
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">How Omni AI Works</h2>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-6 max-w-2xl">
            An eight-stage self-driving sales loop. Every prospect flows through Find → Score → Personalize → Send → Triage → Book → Autopilot → Coach. The agent runs unattended; you focus on the replies that matter.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {omniAiHow.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-white/5 bg-black/20 p-4 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${step.color}`} />
                    <h3 className={`text-sm font-bold ${step.color}`}>{step.title}</h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 p-4 rounded-xl bg-black/30 border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-2">
              Under the hood
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Omni AI runs on its own infrastructure — your data stays in our private database, sequences send through your own verified domain, and every AI decision is logged in an audit trail you can inspect at <span className="text-emerald-400">/dashboard</span> → Runs. The agent respects unsubscribes legally, paces sends to protect your sender reputation, and pauses sequences automatically the moment a prospect replies.
            </p>
          </div>
        </motion.section>

        {/* Sections */}
        <div className="grid gap-6">
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <Card className={`border ${section.border} ${section.bg}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-4 text-base">
                      <div className={`w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${section.color}`} />
                      </div>
                      <span className="text-white">{section.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5">
                      {section.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-gray-300">
                          <CheckCircle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${section.color}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-gray-500"
        >
          <Eye className="w-4 h-4 text-gray-600 flex-shrink-0" />
          This page is only visible to admin accounts. It does not appear in public navigation.
        </motion.div>
      </main>
    </div>
  );
}
