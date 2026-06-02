"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  Mail,
  MousePointerClick,
  RefreshCw,
  Send,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { OperatorIntelligenceSnapshot } from "@/lib/server/direct-postgres";

type Tone = "emerald" | "amber" | "sky" | "violet" | "rose";

const toneClasses: Record<Tone, { border: string; bg: string; text: string; icon: string }> = {
  emerald: {
    border: "border-emerald-300/20",
    bg: "bg-emerald-400/[0.08]",
    text: "text-emerald-200",
    icon: "text-emerald-300",
  },
  amber: {
    border: "border-amber-300/20",
    bg: "bg-amber-400/[0.08]",
    text: "text-amber-200",
    icon: "text-amber-300",
  },
  sky: {
    border: "border-sky-300/20",
    bg: "bg-sky-400/[0.08]",
    text: "text-sky-200",
    icon: "text-sky-300",
  },
  violet: {
    border: "border-violet-300/20",
    bg: "bg-violet-400/[0.08]",
    text: "text-violet-200",
    icon: "text-violet-300",
  },
  rose: {
    border: "border-rose-300/20",
    bg: "bg-rose-400/[0.08]",
    text: "text-rose-200",
    icon: "text-rose-300",
  },
};

type Metric = {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  icon: ElementType;
  href: string;
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function tokenHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatCompact(value: number | undefined | null) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatMoneyFromCents(value: number | undefined | null) {
  const dollars = Number(value || 0) / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 10_000) return `$${Math.round(dollars / 1_000)}k`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSyncTime(value: string | null | undefined) {
  if (!value) return "Not synced";
  return `Synced ${new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const tone = toneClasses[metric.tone];
  return (
    <Link
      href={metric.href}
      className={classNames(
        "group rounded-lg border bg-black/25 p-4 transition-colors hover:bg-white/[0.04]",
        tone.border,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={classNames("flex h-9 w-9 items-center justify-center rounded-md border", tone.border, tone.bg)}>
          <Icon className={classNames("h-4 w-4", tone.icon)} />
        </div>
        <ArrowRight className="h-4 w-4 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{metric.value}</p>
      <p className="mt-1 min-h-[36px] text-sm leading-relaxed text-gray-400">{metric.sub}</p>
    </Link>
  );
}

function SparkBars({ data }: { data: OperatorIntelligenceSnapshot["analytics"]["daily"] }) {
  if (!data.length) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20 p-3 text-sm text-gray-500">
        Site activity stream appears below.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.pageViews), 1);
  return (
    <div className="flex h-24 items-end gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 p-3">
      {data.map((point) => (
        <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-gradient-to-t from-sky-500/45 to-emerald-300/80"
            style={{ height: `${Math.max(8, (point.pageViews / max) * 72)}px` }}
            title={`${formatDate(point.date)}: ${point.pageViews.toLocaleString()} views`}
          />
          <span className="text-[9px] text-gray-600">{new Date(point.date).getDate()}</span>
        </div>
      ))}
    </div>
  );
}

function PriorityCard({ item }: { item: OperatorIntelligenceSnapshot["priorities"][number] }) {
  const tone = toneClasses[item.tone];
  return (
    <Link
      href={item.href}
      className={classNames("group rounded-lg border bg-black/20 p-3 transition-colors hover:bg-white/[0.04]", tone.border)}
    >
      <div className="flex items-start gap-3">
        <div className={classNames("mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border", tone.border, tone.bg)}>
          {item.tone === "rose" ? (
            <AlertTriangle className={classNames("h-3.5 w-3.5", tone.icon)} />
          ) : (
            <CheckCircle2 className={classNames("h-3.5 w-3.5", tone.icon)} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">{item.detail}</p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-amber-300/20 bg-amber-400/[0.06] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-100">Operator intelligence is warming up</p>
          <p className="mt-1 text-sm text-amber-100/70">
            The dashboard loaded instantly; live metrics will retry without blocking the command surface.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-black/20 px-3 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-200/60"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <section className="mt-6 rounded-lg border border-white/[0.08] bg-black/25 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
        <RefreshCw className="h-4 w-4 animate-spin text-sky-300" />
        Syncing live operator intelligence
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Dashboard shell is ready. Website analytics and pipeline metrics are hydrating in the background.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-lg border border-white/10 bg-white/[0.03]" />
        ))}
      </div>
    </section>
  );
}

export function OperatorIntelligencePanel({ enabled }: { enabled: boolean }) {
  const [data, setData] = useState<OperatorIntelligenceSnapshot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRetries, setAutoRetries] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetch("/api/dashboard/operator-intelligence", {
      cache: "no-store",
      headers: tokenHeaders(),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((payload: OperatorIntelligenceSnapshot) => {
        if (cancelled) return;
        setData(payload);
        const isWarming =
          payload.scope.businessCount === 0 &&
          payload.scope.siteCount === 0 &&
          payload.sites.length === 0 &&
          autoRetries < 3;
        if (isWarming) {
          window.setTimeout(() => {
            if (!cancelled) {
              setAutoRetries((count) => count + 1);
              setRefreshKey((value) => value + 1);
            }
          }, 4_000);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [autoRetries, enabled, refreshKey]);

  const metrics = useMemo<Metric[]>(() => {
    if (!data) return [];
    return [
      {
        label: "Analytics",
        value: formatCompact(data.analytics.pageViews7d),
        sub: `${formatCompact(data.analytics.sessions7d)} visitors, ${formatCompact(data.analytics.ctaClicks7d)} CTA clicks from mapped sites.`,
        tone: "sky",
        icon: BarChart3,
        href: "/dashboard/analytics",
      },
      {
        label: "Pipeline",
        value: formatMoneyFromCents(data.pipeline.weightedPipelineCents),
        sub: `${formatCompact(data.pipeline.hotLeads)} hot leads, ${formatCompact(data.pipeline.stuckDeals)} stuck deals.`,
        tone: data.pipeline.stuckDeals > 0 ? "rose" : "emerald",
        icon: BriefcaseBusiness,
        href: "/dashboard/pipeline",
      },
      {
        label: "Newsletter",
        value: formatCompact(data.newsletter.publishedPosts),
        sub: `${formatCompact(data.newsletter.premiumPosts)} premium, ${formatCompact(data.newsletter.freePosts)} free, ${formatCompact(data.newsletter.drafts)} drafts.`,
        tone: "amber",
        icon: Mail,
        href: "/dashboard/marketing",
      },
      {
        label: "Subscribers",
        value: formatCompact(data.subscribers.active),
        sub: data.scope.mode === "portfolio"
          ? `${formatCompact(data.subscribers.premium)} premium, ${formatCompact(data.subscribers.new7d)} new this week.`
          : `${formatCompact(data.subscribers.new30d)} website subscriber events in 30 days.`,
        tone: "violet",
        icon: Users,
        href: "/dashboard/marketing",
      },
    ];
  }, [data]);

  if (!enabled) return null;
  if (loading && !data) return <LoadingPanel />;
  if (failed || !data) return <section className="mt-6"><EmptyState onRetry={() => setRefreshKey((v) => v + 1)} /></section>;

  const latestBooking = data.bookings.latest[0];
  const topBusiness = data.pipeline.businesses[0];

  return (
    <section className="mt-6 rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.045] via-black/25 to-sky-500/[0.04] p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Zap className="h-3.5 w-3.5" />
            Live Operator Intelligence
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {data.scope.mode === "portfolio" ? "Portfolio command intelligence" : "Your live business cockpit"}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {data.scope.businessCount.toLocaleString()} workspace{data.scope.businessCount === 1 ? "" : "s"} mapped -
            {" "}{data.scope.siteCount.toLocaleString()} website tracker{data.scope.siteCount === 1 ? "" : "s"} connected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.08] px-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </span>
            Live
          </span>
          <button
            type="button"
            onClick={() => setRefreshKey((v) => v + 1)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-300 transition-colors hover:border-sky-300/35 hover:text-sky-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">Traffic Pulse</p>
              <p className="mt-1 text-sm text-gray-400">
                {formatCompact(data.analytics.visitors7d)} visitors, {data.analytics.conversionRate}% form submit rate.
              </p>
            </div>
            <MousePointerClick className="h-5 w-5 text-sky-300" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-sky-300/15 bg-sky-400/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200">Views</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(data.analytics.pageViews7d)}</p>
            </div>
            <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Leads</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(data.pipeline.newLeads7d)}</p>
            </div>
            <div className="rounded-lg border border-amber-300/15 bg-amber-400/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">Bookings</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(data.bookings.total)}</p>
            </div>
          </div>
          <div className="mt-3">
            <SparkBars data={data.analytics.daily} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.analytics.topPages.slice(0, 4).map((page) => (
              <div key={page.page} className="flex items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                <span className="min-w-0 truncate text-xs text-gray-300">{page.page}</span>
                <span className="text-xs font-semibold text-white">{formatCompact(page.views)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Priority Queue</p>
              <p className="mt-1 text-sm text-gray-400">What deserves human attention first.</p>
            </div>
            <Activity className="h-5 w-5 text-amber-300" />
          </div>
          <div className="grid gap-2">
            {data.priorities.map((item) => (
              <PriorityCard key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/[0.08] bg-black/20 p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Website Fleet</p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {data.scope.mode === "portfolio" ? "Client sites reporting in" : "Your website data"}
            </h3>
          </div>
          <Link
            href="/dashboard/analytics"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-gray-300 transition-colors hover:border-emerald-300/35 hover:text-emerald-100"
          >
            Deep analytics
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {data.sites.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.sites.slice(0, 6).map((site) => (
              <div key={site.slug} className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={classNames(
                        "h-2.5 w-2.5 rounded-full",
                        site.pageViews30d > 0 ? "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.65)]" : "bg-rose-300",
                      )} />
                    <p className="text-sm font-semibold text-white">{site.label}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">/{site.slug} · {formatSyncTime(site.refreshedAt)}</p>
                  </div>
                  <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-300">
                    {site.conversionRate}% conv.
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ["Views", site.pageViews30d],
                    ["Leads", site.leads30d],
                    ["Calls", site.bookings30d],
                    ["Subs", site.subscribers30d],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-white/[0.08] bg-black/20 p-2">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatCompact(Number(value))}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  {site.topPages.slice(0, 2).map((page) => (
                    <div key={page.page} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-gray-400">{page.page}</span>
                      <span className="font-semibold text-gray-200">{formatCompact(page.views)}</span>
                    </div>
                  ))}
                  {site.topPages.length === 0 && (
                    <p className="text-xs text-gray-500">No page events yet. Tracker needs attention.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-300/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100/80">
            No website tracker is mapped to this dashboard yet. Add a business slug and `omni_business_users` mapping to light this up.
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Pipeline Leaders</p>
            <TrendingUp className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="space-y-2">
            {data.pipeline.businesses.slice(0, 4).map((business) => (
              <div key={business.id || business.name} className="rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-white">{business.name}</p>
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatMoneyFromCents(business.weightedPipelineCents)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatCompact(business.leads)} leads - {formatCompact(business.hot)} hot - {formatCompact(business.activeDeals)} active
                </p>
              </div>
            ))}
            {!topBusiness && <p className="text-sm text-gray-500">No pipeline rows yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Newsletter Posts</p>
            <FileText className="h-4 w-4 text-amber-300" />
          </div>
          <div className="space-y-2">
            {data.newsletter.recentPosts.slice(0, 4).map((post) => (
              <Link
                key={post.slug}
                href={`/newsletter/${post.slug}`}
                className="block rounded-md border border-white/[0.08] bg-white/[0.025] p-3 transition-colors hover:border-amber-300/35"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-white">{post.subject}</p>
                  <span className="rounded-md border border-amber-300/20 bg-amber-400/[0.08] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                    {post.tier}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{formatDate(post.publishedAt)}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Revenue Intake</p>
            <CalendarDays className="h-4 w-4 text-violet-300" />
          </div>
          <div className="grid gap-2">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
              <p className="text-sm font-semibold text-white">{formatCompact(data.bookings.upcoming)} upcoming calls</p>
              <p className="mt-1 text-xs text-gray-500">{formatCompact(data.bookings.new7d)} new booking requests this week.</p>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
              <p className="text-sm font-semibold text-white">{formatCompact(data.campaigns.active)} active campaigns</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatCompact(data.campaigns.total)} total campaigns, ${formatCompact(data.campaigns.budgetUsd)} tracked budget.
              </p>
            </div>
            {latestBooking && (
              <div className="rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
                <p className="truncate text-sm font-semibold text-white">{latestBooking.name}</p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  Latest booking - {formatDate(latestBooking.createdAt)} - {latestBooking.email}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/dashboard/analytics", label: "Analytics lab", icon: BarChart3, tone: "sky" as Tone },
          { href: "/dashboard/pipeline", label: "Deal pipeline", icon: BriefcaseBusiness, tone: "emerald" as Tone },
          { href: "/dashboard/marketing", label: "Newsletter studio", icon: Mail, tone: "amber" as Tone },
          { href: "/dashboard/outreach", label: "Outreach engine", icon: Send, tone: "violet" as Tone },
        ].map((item) => {
          const Icon = item.icon;
          const tone = toneClasses[item.tone];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames("group flex items-center justify-between gap-3 rounded-lg border bg-black/20 px-4 py-3 transition-colors hover:bg-white/[0.04]", tone.border)}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                <Icon className={classNames("h-4 w-4 flex-shrink-0", tone.icon)} />
                <span className="truncate">{item.label}</span>
              </span>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
