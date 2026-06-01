"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { ElementType } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Crown,
  Database,
  FileText,
  Flame,
  Gauge,
  Inbox,
  Layers3,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

type ModuleTone = "emerald" | "amber" | "sky" | "violet" | "rose" | "blue";

type DashboardModule = {
  title: string;
  label: string;
  description: string;
  href: string;
  icon: ElementType;
  tone: ModuleTone;
  adminOnly?: boolean;
};

const toneClasses: Record<ModuleTone, {
  border: string;
  bg: string;
  text: string;
  icon: string;
  glow: string;
}> = {
  emerald: {
    border: "border-emerald-400/20 hover:border-emerald-300/45",
    bg: "from-emerald-500/[0.13]",
    text: "text-emerald-200",
    icon: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20",
    glow: "shadow-[0_0_28px_rgba(16,185,129,0.10)]",
  },
  amber: {
    border: "border-amber-400/20 hover:border-amber-300/45",
    bg: "from-amber-500/[0.14]",
    text: "text-amber-200",
    icon: "text-amber-300 bg-amber-400/10 border-amber-300/20",
    glow: "shadow-[0_0_28px_rgba(245,158,11,0.10)]",
  },
  sky: {
    border: "border-sky-400/20 hover:border-sky-300/45",
    bg: "from-sky-500/[0.13]",
    text: "text-sky-200",
    icon: "text-sky-300 bg-sky-400/10 border-sky-300/20",
    glow: "shadow-[0_0_28px_rgba(14,165,233,0.10)]",
  },
  violet: {
    border: "border-violet-400/20 hover:border-violet-300/45",
    bg: "from-violet-500/[0.13]",
    text: "text-violet-200",
    icon: "text-violet-300 bg-violet-400/10 border-violet-300/20",
    glow: "shadow-[0_0_28px_rgba(139,92,246,0.10)]",
  },
  rose: {
    border: "border-rose-400/20 hover:border-rose-300/45",
    bg: "from-rose-500/[0.13]",
    text: "text-rose-200",
    icon: "text-rose-300 bg-rose-400/10 border-rose-300/20",
    glow: "shadow-[0_0_28px_rgba(244,63,94,0.10)]",
  },
  blue: {
    border: "border-blue-400/20 hover:border-blue-300/45",
    bg: "from-blue-500/[0.13]",
    text: "text-blue-200",
    icon: "text-blue-300 bg-blue-400/10 border-blue-300/20",
    glow: "shadow-[0_0_28px_rgba(59,130,246,0.10)]",
  },
};

const primaryModules: DashboardModule[] = [
  {
    title: "Contacts CRM",
    label: "Pipeline",
    description: "Work leads, sponsors, affiliates, and client contacts without waiting on the old overview panel.",
    href: "/dashboard/leads",
    icon: Users,
    tone: "emerald",
  },
  {
    title: "Outreach",
    label: "Revenue",
    description: "Draft, send, and review follow-ups from the outbound command surface.",
    href: "/dashboard/outreach",
    icon: Send,
    tone: "sky",
  },
  {
    title: "Meetings",
    label: "Booking",
    description: "Review scheduled calls and route new appointments from the booking flow.",
    href: "/dashboard/meetings",
    icon: CalendarDays,
    tone: "violet",
  },
  {
    title: "Newsletter",
    label: "Interlinked",
    description: "Manage publication workflow, premium/free issues, and the public archive.",
    href: "/dashboard/marketing",
    icon: Mail,
    tone: "amber",
  },
];

const operatingModules: DashboardModule[] = [
  {
    title: "Client CEOs",
    label: "Fleet",
    description: "Inspect each client agent, data gaps, and the next revenue action per business.",
    href: "/dashboard/agents",
    icon: Bot,
    tone: "violet",
    adminOnly: true,
  },
  {
    title: "Companies",
    label: "Accounts",
    description: "Open company records, enrichment status, and account-level moves.",
    href: "/dashboard/companies",
    icon: Building2,
    tone: "blue",
    adminOnly: true,
  },
  {
    title: "Analytics",
    label: "Signal",
    description: "Open analytics only when you need the heavier charts and attribution reads.",
    href: "/dashboard/analytics",
    icon: BarChart3,
    tone: "sky",
    adminOnly: true,
  },
  {
    title: "Campaigns",
    label: "Execution",
    description: "Create and manage marketing campaigns without loading them into the homepage.",
    href: "/dashboard/campaigns",
    icon: Megaphone,
    tone: "rose",
    adminOnly: true,
  },
  {
    title: "Pipeline",
    label: "Deals",
    description: "Switch between contacts, sponsors, affiliates, and high-value opportunities.",
    href: "/dashboard/pipeline",
    icon: BriefcaseBusiness,
    tone: "emerald",
  },
  {
    title: "Inbox",
    label: "Messages",
    description: "Centralize inbound conversations and follow-up decisions.",
    href: "/dashboard/inbox",
    icon: Inbox,
    tone: "blue",
  },
  {
    title: "Council",
    label: "Pantheon",
    description: "Open the council roster, decision context, and operator intelligence surfaces.",
    href: "/dashboard/council",
    icon: Crown,
    tone: "amber",
  },
  {
    title: "Settings",
    label: "Control",
    description: "Account, billing, workspace, and system controls.",
    href: "/dashboard/settings",
    icon: Settings,
    tone: "violet",
  },
];

const statusItems = [
  { label: "Dashboard shell", value: "Instant", icon: Gauge, tone: "emerald" as ModuleTone },
  { label: "Booking capture", value: "Postgres", icon: Database, tone: "sky" as ModuleTone },
  { label: "Newsletter", value: "Live", icon: FileText, tone: "amber" as ModuleTone },
  { label: "Agent fleet", value: "Ready", icon: Bot, tone: "violet" as ModuleTone },
];

const executionQueue = [
  {
    title: "Capture and route new booked calls",
    detail: "Booking submissions now land in Postgres first, then can be mirrored into the heavier CRM layer.",
    href: "/dashboard/meetings",
    icon: CalendarDays,
    tone: "sky" as ModuleTone,
  },
  {
    title: "Review newest Interlinked issues",
    detail: "Newsletter production, archive polish, and premium/free shelves are live.",
    href: "/newsletter",
    icon: Mail,
    tone: "amber" as ModuleTone,
  },
  {
    title: "Open client CEO fleet",
    detail: "Inspect which client systems have data gaps, next moves, and upgrade opportunities.",
    href: "/dashboard/agents",
    icon: Bot,
    tone: "violet" as ModuleTone,
  },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ModuleCard({ module }: { module: DashboardModule }) {
  const Icon = module.icon;
  const tone = toneClasses[module.tone];

  return (
    <Link
      href={module.href}
      className={classNames(
        "group block rounded-lg border bg-gradient-to-br via-white/[0.025] to-white/[0.015] p-4 transition-all hover:-translate-y-0.5",
        tone.border,
        tone.bg,
        tone.glow,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className={classNames("flex h-10 w-10 items-center justify-center rounded-md border", tone.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={classNames("rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", tone.text)}>
          {module.label}
        </span>
      </div>
      <h3 className="text-base font-semibold text-white">{module.title}</h3>
      <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-gray-400">{module.description}</p>
      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-300 transition-colors group-hover:text-white">
        Open
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function StatusCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ElementType;
  tone: ModuleTone;
}) {
  const styles = toneClasses[tone];

  return (
    <div className={classNames("rounded-lg border bg-black/25 p-3 sm:p-4", styles.border)}>
      <div className="flex items-center justify-between gap-3">
        <div className={classNames("flex h-8 w-8 items-center justify-center rounded-md border sm:h-9 sm:w-9", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <CheckCircle2 className={classNames("h-4 w-4", styles.text)} />
      </div>
      <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-500 sm:mt-4 sm:text-[10px] sm:tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white sm:text-xl">{value}</p>
    </div>
  );
}

function SkeletonGate() {
  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto max-w-7xl px-5 py-6">
        <div className="h-10 w-36 rounded-lg bg-white/[0.06]" />
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { profile, isAdmin: profileIsAdmin, displayName } = useProfile();

  const isAdmin = user?.is_admin === true || profileIsAdmin === true;
  const shownName =
    displayName ||
    profile?.first_name ||
    profile?.name ||
    user?.username ||
    "Operator";

  const visibleOperatingModules = useMemo(
    () => operatingModules.filter((module) => !module.adminOnly || isAdmin),
    [isAdmin],
  );

  useEffect(() => {
    if (!loading && !user) {
      const timer = window.setTimeout(() => router.push("/"), 300);
      return () => window.clearTimeout(timer);
    }
  }, [loading, router, user]);

  if (loading) return <SkeletonGate />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] px-5 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
          <Shield className="mx-auto h-8 w-8 text-violet-300" />
          <h1 className="mt-4 text-xl font-semibold">Dashboard access required</h1>
          <p className="mt-2 text-sm text-gray-400">Redirecting you back to sign in.</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white noise-overlay">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-sky-300" />
            <span className="text-lg font-bold text-gradient">Omni AI</span>
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.08] px-3 text-sm font-semibold text-violet-200 transition-colors hover:border-violet-300/45 sm:inline-flex"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-300 transition-colors hover:border-rose-300/35 hover:text-rose-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:py-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.06] via-white/[0.025] to-emerald-500/[0.06] p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Zap className="h-3.5 w-3.5" />
                Instant Command Center
              </span>
              {isAdmin && (
                <span className="inline-flex items-center gap-2 rounded-md border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                  <Crown className="h-3.5 w-3.5" />
                  Admin Mode
                </span>
              )}
            </div>
            <p className="mt-8 text-sm text-gray-500">Welcome back, {shownName}</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-bold leading-tight tracking-normal text-white md:text-5xl">
              Your Omni AI operating console
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-300 md:text-lg">
              A clean first screen for action: CRM, bookings, newsletter,
              client agents, analytics, and execution systems. Heavy data
              modules stay behind focused links so this page loads immediately.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/leads"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-200/60 hover:bg-emerald-400/15"
              >
                <Target className="h-4 w-4" />
                Open CRM
              </Link>
              <Link
                href="/dashboard/agents"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-violet-300/25 bg-violet-400/10 px-4 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-200/55 hover:bg-violet-400/15"
              >
                <Bot className="h-4 w-4" />
                Client CEOs
              </Link>
              <Link
                href="/newsletter"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-200/55 hover:bg-amber-400/15"
              >
                <Mail className="h-4 w-4" />
                Newsletter
              </Link>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-1">
            {statusItems.map((item) => (
              <StatusCard key={item.label} {...item} />
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {primaryModules.map((module) => (
            <ModuleCard key={module.title} module={module} />
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-lg border border-white/[0.08] bg-black/25 p-5">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Execution Queue</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Best next actions</h2>
              </div>
              <Link
                href="/dashboard/runs"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-300 transition-colors hover:border-sky-300/35 hover:text-sky-100"
              >
                Run log
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3">
              {executionQueue.map((item) => {
                const Icon = item.icon;
                const tone = toneClasses[item.tone];
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={classNames("group rounded-lg border bg-white/[0.025] p-4 transition-colors", tone.border)}
                  >
                    <div className="flex gap-3">
                      <div className={classNames("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border", tone.icon)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                          <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-gray-400">{item.detail}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-black/25 p-5">
            <div className="mb-5 border-b border-white/[0.08] pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">System Notes</p>
              <h2 className="mt-1 text-xl font-semibold text-white">What changed</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                <p className="text-sm leading-relaxed text-gray-300">
                  Homepage dashboard no longer waits on lead tables, campaign queries, analytics, or embedded AGI tabs.
                </p>
              </div>
              <div className="flex gap-3">
                <Database className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-300" />
                <p className="text-sm leading-relaxed text-gray-300">
                  Booking intake uses the fast Postgres capture path, while the older CRM mirror can be repaired separately.
                </p>
              </div>
              <div className="flex gap-3">
                <Layers3 className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-300" />
                <p className="text-sm leading-relaxed text-gray-300">
                  Specialist dashboards still exist, but load only when opened.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Operations Library</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Dashboard tools</h2>
            </div>
            <Link
              href="/dashboard/command-center"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-300 transition-colors hover:border-violet-300/35 hover:text-violet-100"
            >
              Command center
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleOperatingModules.map((module) => (
              <ModuleCard key={module.title} module={module} />
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/coach"
            className="group rounded-lg border border-white/[0.08] bg-black/25 p-5 transition-colors hover:border-emerald-300/35"
          >
            <MessageSquare className="h-5 w-5 text-emerald-300" />
            <h3 className="mt-4 font-semibold text-white">AI Coach</h3>
            <p className="mt-2 text-sm text-gray-400">Ask for the next move, objection handling, or account strategy.</p>
          </Link>
          <Link
            href="/dashboard/templates"
            className="group rounded-lg border border-white/[0.08] bg-black/25 p-5 transition-colors hover:border-amber-300/35"
          >
            <FileText className="h-5 w-5 text-amber-300" />
            <h3 className="mt-4 font-semibold text-white">Templates</h3>
            <p className="mt-2 text-sm text-gray-400">Open saved campaign, outreach, and client delivery templates.</p>
          </Link>
          <Link
            href="/dashboard/heatmap"
            className="group rounded-lg border border-white/[0.08] bg-black/25 p-5 transition-colors hover:border-rose-300/35"
          >
            <Flame className="h-5 w-5 text-rose-300" />
            <h3 className="mt-4 font-semibold text-white">Heatmap</h3>
            <p className="mt-2 text-sm text-gray-400">Scan priority surfaces when you need deeper performance views.</p>
          </Link>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] py-5 text-sm text-gray-500">
          <span>Omni AI command surface</span>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 hover:text-white">
              <CircleDollarSign className="h-4 w-4" />
              Billing
            </Link>
            <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 hover:text-white">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <Link href="/arena" className="inline-flex items-center gap-1.5 hover:text-white">
              <Trophy className="h-4 w-4" />
              Arena
            </Link>
            <Link href="/search" className="inline-flex items-center gap-1.5 hover:text-white">
              <Search className="h-4 w-4" />
              Search
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
