"use client";

import { useEffect, useId, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle2, Circle, Phone, MessageSquare, Clock } from "lucide-react";
import type {
  AdsReport,
  DemoMetrics,
  DemoTask,
  LeadSourceRow,
  PipelineStage,
  ValueBar,
} from "@/lib/portal-demo-clients";

// ── shared helpers ───────────────────────────────────────────────────

export function formatMoney(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString();
}

const DONUT_PALETTE = [
  "#a78bfa", // violet
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#fb7185", // rose
  "#e879f9", // fuchsia
  "#22d3ee", // cyan
  "#a3e635", // lime
  "#fb923c", // orange
  "#94a3b8", // slate
];

// ── animation helpers ────────────────────────────────────────────────

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

// Count a number up from 0 → target on mount (easeOutCubic).
function useCountUp(target: number, durationMs = 950) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

// A progress-bar fill that animates its width from 0 → pct on mount.
function AnimatedBar({ pct, className }: { pct: number; className: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setW(pct);
      return;
    }
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return <div className={className} style={{ width: `${w}%` }} />;
}

// Mount flag for entrance transitions.
function useMounted() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return shown;
}

function WidgetCard({
  title,
  action,
  fullWidth,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const shown = useMounted();
  return (
    <section
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_30px_-14px_rgba(0,0,0,0.7)] transition-[opacity,transform,border-color] duration-500 ease-out hover:border-white/[0.16] ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${fullWidth ? "sm:col-span-2 xl:col-span-3" : ""}`}
    >
      {/* top sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ── donuts ───────────────────────────────────────────────────────────

function Donut({
  slices,
  centerTop,
  centerBottom,
}: {
  slices: { name: string; value: number; color: string }[];
  centerTop: string;
  centerBottom?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const data = slices.filter((s) => s.value > 0);
  // All-zero datasets still need a visible ring.
  const chartData = data.length
    ? data
    : [{ name: "empty", value: 1, color: "rgba(255,255,255,0.07)" }];
  return (
    <div
      className="relative h-[184px]"
      style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.45))" }}
    >
      <ResponsiveContainer width="100%" height={184}>
        <PieChart>
          <defs>
            {chartData.map((entry, i) => (
              <linearGradient
                key={i}
                id={`donut-${uid}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.98} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={chartData}
            dataKey="value"
            innerRadius={62}
            outerRadius={82}
            stroke="none"
            cornerRadius={7}
            paddingAngle={data.length > 1 ? 3 : 0}
            isAnimationActive
            animationBegin={120}
            animationDuration={950}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={`url(#donut-${uid}-${i})`} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold leading-none tracking-tight text-white tabular-nums">
          {centerTop}
        </span>
        {centerBottom ? (
          <span className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
            {centerBottom}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function OpportunityStatusWidget({
  data,
}: {
  data: DemoMetrics["opportunities"];
}) {
  const slices = [
    { name: "Won", value: data.won, color: "#34d399" },
    { name: "Lost", value: data.lost, color: "#fb7185" },
    { name: "Open", value: data.open, color: "#38bdf8" },
  ];
  const total = useCountUp(data.total);
  return (
    <WidgetCard title="Opportunity Status">
      <Donut
        slices={slices}
        centerTop={formatCompact(Math.round(total))}
        centerBottom="opportunities"
      />
      <div className="mt-3 space-y-1.5">
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-sm">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-white/60">{s.name}</span>
              <span className="ml-auto tabular-nums text-white/80">
                {s.value}
              </span>
            </div>
          ))}
      </div>
    </WidgetCard>
  );
}

export function ConversionRateWidget({
  data,
}: {
  data: DemoMetrics["conversion"];
}) {
  const slices = [
    { name: "Won", value: data.ratePct, color: "#38bdf8" },
    {
      name: "Rest",
      value: Math.max(0, 100 - data.ratePct),
      color: "rgba(255,255,255,0.08)",
    },
  ];
  const rate = useCountUp(data.ratePct);
  return (
    <WidgetCard title="Conversion Rate">
      <Donut slices={slices} centerTop={`${rate.toFixed(1)}%`} />
      <p className="mt-3 text-center text-sm text-white/50">
        Won revenue{" "}
        <span className="font-medium text-emerald-300">
          {formatMoney(data.wonRevenue)}
        </span>
      </p>
    </WidgetCard>
  );
}

export function StageDistributionWidget({
  data,
}: {
  data: DemoMetrics["stageDistribution"];
}) {
  const slices = data.stages.map((s, i) => ({
    name: s.stage,
    value: s.count,
    color: DONUT_PALETTE[i % DONUT_PALETTE.length],
  }));
  const total = useCountUp(data.total);
  return (
    <WidgetCard title="Stage Distribution">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="w-full sm:w-1/2">
          <Donut slices={slices} centerTop={formatCompact(Math.round(total))} />
        </div>
        <div className="max-h-[180px] w-full space-y-1.5 overflow-y-auto pr-1 sm:w-1/2">
          {slices.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-white/60">{s.name}</span>
              <span className="ml-auto shrink-0 tabular-nums text-white/80">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

// ── bars ─────────────────────────────────────────────────────────────

export function OpportunityValueWidget({
  data,
}: {
  data: DemoMetrics["opportunityValue"];
}) {
  const max = Math.max(...data.bars.map((b) => b.value), 1);
  const total = useCountUp(data.total);
  return (
    <WidgetCard title="Opportunity Value">
      <p className="mb-4 text-3xl font-bold tracking-tight text-white tabular-nums">
        {formatMoney(Math.round(total))}
      </p>
      <div className="space-y-3">
        {data.bars.map((bar: ValueBar) => (
          <div key={bar.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="truncate pr-2 text-white/60">{bar.label}</span>
              <span className="shrink-0 tabular-nums text-white/80">
                {formatMoney(bar.value)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
              <AnimatedBar
                pct={(bar.value / max) * 100}
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400 shadow-[0_0_10px_rgba(129,140,248,0.4)] transition-[width] duration-700 ease-out"
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

export function FunnelWidget({ data }: { data: DemoMetrics["funnel"] }) {
  const total = data.stages.reduce((sum, s) => sum + s.count, 0) || 1;
  const max = Math.max(...data.stages.map((s) => s.count), 1);
  let remaining = total;
  const rows = data.stages.map((s: PipelineStage) => {
    const cumulativePct = (remaining / total) * 100;
    remaining -= s.count;
    return { ...s, cumulativePct };
  });
  return (
    <WidgetCard title={`Funnel · ${data.pipelineName}`} fullWidth>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.stage} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-white/60 sm:w-48">
              {row.stage}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
              <AnimatedBar
                pct={(row.count / max) * 100}
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 shadow-[0_0_10px_rgba(129,140,248,0.35)] transition-[width] duration-700 ease-out"
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-white/80">
              {row.count}
            </span>
            <span className="hidden w-14 shrink-0 text-right text-xs tabular-nums text-white/40 sm:block">
              {row.cumulativePct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ── stat grids ───────────────────────────────────────────────────────

function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; accent?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-3.5 transition-colors duration-300 hover:border-white/[0.14]"
        >
          <p className="text-[11px] uppercase tracking-wide text-white/45">
            {s.label}
          </p>
          <p
            className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.accent ?? "text-white"}`}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AdsReportWidget({
  title,
  data,
  accent,
}: {
  title: string;
  data: AdsReport;
  accent: string;
}) {
  return (
    <WidgetCard title={title}>
      <StatGrid
        stats={[
          { label: "Total Clicks", value: formatCompact(data.clicks), accent },
          { label: "Total Spent", value: formatMoney(data.spend), accent },
          { label: "CPC", value: `$${data.cpc.toFixed(2)}` },
          { label: "CTR", value: `${data.ctrPct}%` },
        ]}
      />
    </WidgetCard>
  );
}

export function GoogleAnalyticsWidget({
  data,
}: {
  data: DemoMetrics["googleAnalytics"];
}) {
  return (
    <WidgetCard title="Google Analytics Report">
      <StatGrid
        stats={[
          { label: "Total Visitors", value: formatCompact(data.visitors) },
          { label: "Sessions", value: formatCompact(data.sessions) },
          { label: "Page Views", value: formatCompact(data.pageViews) },
          { label: "Bounce Rate", value: `${data.bounceRatePct}%` },
        ]}
      />
    </WidgetCard>
  );
}

export function GoogleBusinessProfileWidget({
  data,
}: {
  data: DemoMetrics["googleBusinessProfile"];
}) {
  return (
    <WidgetCard title="Google Business Profile">
      <StatGrid
        stats={[
          { label: "Profile Views", value: formatCompact(data.views) },
          { label: "Searches", value: formatCompact(data.searches) },
          { label: "Website Clicks", value: formatCompact(data.clicks) },
          { label: "Bookings", value: formatCompact(data.bookings) },
        ]}
      />
    </WidgetCard>
  );
}

export function SalesEfficiencyWidget({
  data,
}: {
  data: DemoMetrics["salesEfficiency"];
}) {
  const days = (n: number) => (n === 0 ? "0s" : `${n}d`);
  return (
    <WidgetCard title="Sales Efficiency">
      <StatGrid
        stats={[
          {
            label: "Avg Sales Duration",
            value: days(data.avgSalesDurationDays),
          },
          { label: "Time to Won", value: days(data.avgTimeToWonDays) },
          {
            label: "Sales Velocity",
            value: `${formatMoney(data.salesVelocityPerMonth)}/M`,
            accent: "text-emerald-300",
          },
        ]}
      />
    </WidgetCard>
  );
}

export function ManualActionsWidget({
  data,
}: {
  data: DemoMetrics["manualActions"];
}) {
  const items = [
    {
      label: "Phone",
      value: data.phone,
      Icon: Phone,
      tone: "border-sky-300/20 bg-sky-400/[0.08] text-sky-200",
      iconTone: "text-sky-300",
    },
    {
      label: "SMS",
      value: data.sms,
      Icon: MessageSquare,
      tone: "border-violet-300/20 bg-violet-400/[0.08] text-violet-200",
      iconTone: "text-violet-300",
    },
    {
      label: "Total Pending",
      value: data.pending,
      Icon: Clock,
      tone: "border-amber-300/20 bg-amber-400/[0.08] text-amber-200",
      iconTone: "text-amber-300",
    },
  ];
  return (
    <WidgetCard title="Manual Actions">
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ label, value, Icon, tone, iconTone }) => (
          <div
            key={label}
            className={`flex flex-col items-center rounded-lg border p-3 ${tone}`}
          >
            <Icon className={`mb-1.5 h-4 w-4 ${iconTone}`} />
            <span className="text-xl font-semibold text-white">{value}</span>
            <span className="mt-0.5 text-center text-[10px] uppercase tracking-wide text-white/50">
              {label}
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// ── tasks ────────────────────────────────────────────────────────────

export function TasksWidget({ tasks }: { tasks: DemoTask[] }) {
  return (
    <WidgetCard title="Tasks">
      {tasks.length === 0 ? (
        <p className="text-sm text-white/40">No open tasks.</p>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.title} className="flex items-start gap-2.5 text-sm">
              {task.status === "completed" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
              )}
              <span
                className={
                  task.status === "completed"
                    ? "text-white/40 line-through"
                    : "text-white/80"
                }
              >
                {task.title}
              </span>
              {task.due ? (
                <span className="ml-auto shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/50">
                  {task.due}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── lead source table ────────────────────────────────────────────────

export function LeadSourceWidget({
  data,
}: {
  data: DemoMetrics["leadSources"];
}) {
  const total = useCountUp(data.total);
  return (
    <WidgetCard
      title="Lead Source Report"
      fullWidth
      action={
        data.trendPct != null ? (
          <span className="rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-2 py-0.5 text-xs font-medium text-emerald-300">
            +{data.trendPct}% vs previous period
          </span>
        ) : undefined
      }
    >
      <p className="mb-3 text-3xl font-bold tracking-tight text-white tabular-nums">
        {formatCompact(Math.round(total))}
        <span className="ml-2 text-sm font-normal text-white/40">
          total leads
        </span>
      </p>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wide text-white/40">
              <th className="py-2 pr-3 font-medium">Source</th>
              <th className="py-2 pr-3 text-right font-medium">Leads</th>
              <th className="py-2 pr-3 text-right font-medium">Value</th>
              <th className="py-2 pr-3 text-right font-medium">Open</th>
              <th className="py-2 pr-3 text-right font-medium">Won</th>
              <th className="py-2 pr-3 text-right font-medium">Lost</th>
              <th className="py-2 pr-3 text-right font-medium">Abandoned</th>
              <th className="py-2 text-right font-medium">Win %</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: LeadSourceRow) => (
              <tr
                key={row.source}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="py-2.5 pr-3 text-white/80">{row.source}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-white/70">
                  {row.totalLeads}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-white/70">
                  {formatMoney(row.totalValue)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-white/70">
                  {row.open}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-300">
                  {row.won}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-rose-300">
                  {row.lost}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-white/70">
                  {row.abandoned}
                </td>
                <td className="py-2.5 text-right tabular-nums text-white/80">
                  {row.winPct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}
