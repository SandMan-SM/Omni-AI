"use client";
export const dynamic = 'force-dynamic';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield, Lock, Users, Database, Key, AlertTriangle,
  CheckCircle, Eye, Settings, ArrowLeft, Crown, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";

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

        {/* Sections */}
        <div className="grid gap-5">
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
                    <CardTitle className="flex items-center gap-3 text-base">
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
          className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-gray-500"
        >
          <Eye className="w-4 h-4 text-gray-600 flex-shrink-0" />
          This page is only visible to admin accounts. It does not appear in public navigation.
        </motion.div>
      </main>
    </div>
  );
}
