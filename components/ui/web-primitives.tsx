/**
 * OMNI AI — WEB DESIGN SYSTEM (locked)
 * ----------------------------------------------------------------------------
 * Read `docs/web-design-system.md` BEFORE editing this file. Every page that
 * a transactional email links to routes through these primitives. If you
 * "simplify" one of these into a raw div in a caller, you are reverting.
 *
 * Companion to `lib/email-template.ts` — that file locks email rendering,
 * this one locks the web pages the emails point at. The contract is that
 * the linked page always feels one tier MORE premium than its email.
 */
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export type Accent = "green" | "cyan" | "purple" | "amber" | "red";

/** Locked web token palette. Matches `docs/web-design-system.md`. */
export const WEB = {
  canvas: "#05050a",
  surface: "#0d0d14",
  surfaceRaised: "#13131c",
  borderDefault: "#1f1f2c",
  borderStrong: "#2a2a3a",
  textPrimary: "#f4f6fb",
  textBody: "#d9dde5",
  textMuted: "#9aa0ad",
  textSubtle: "#6a6f7c",
  green: "#10b981",
  cyan: "#06b6d4",
  purple: "#a855f7",
  amber: "#f59e0b",
  red: "#ef4444",
} as const;

export const accentHex: Record<Accent, string> = {
  green: WEB.green,
  cyan: WEB.cyan,
  purple: WEB.purple,
  amber: WEB.amber,
  red: WEB.red,
};

/** fmtMoney mirrors the email helper — same output on both sides. */
export const fmtMoney = (n: number): string =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${Math.round(n).toLocaleString()}`;

/** Outer canvas shell. Every linked-from-email page wraps its children here. */
export function PageShell({
  accent = "green",
  children,
}: {
  accent?: Accent;
  children: ReactNode;
}) {
  const acc = accentHex[accent];
  return (
    <div
      style={{ backgroundColor: WEB.canvas, color: WEB.textBody }}
      className="min-h-screen relative"
    >
      {/* Soft accent wash — one only, upper-left, never two. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-[0.10] blur-3xl"
        style={{ background: `radial-gradient(600px 320px at 20% 0%, ${acc}, transparent 70%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Sticky top bar with live dot. */
export function PageTopBar({
  label,
  accent = "green",
  right,
}: {
  label: string;
  accent?: Accent;
  right?: ReactNode;
}) {
  const acc = accentHex[accent];
  return (
    <div
      className="sticky top-0 z-40 backdrop-blur-md border-b"
      style={{ backgroundColor: "rgba(5,5,10,0.8)", borderColor: WEB.borderDefault }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: acc, boxShadow: `0 0 8px ${acc}` }}
          />
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: WEB.textMuted }}
          >
            {label}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">{right}</div>
      </div>
    </div>
  );
}

/** Hero block — eyebrow, title, meta, optional lede. */
export function PageHero({
  eyebrow,
  title,
  meta,
  lede,
  accent = "green",
  right,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  lede?: string;
  accent?: Accent;
  right?: ReactNode;
}) {
  const acc = accentHex[accent];
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-6xl mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-6 md:pb-8"
    >
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[260px]">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.2em] mb-3"
            style={{ color: acc }}
          >
            {eyebrow}
          </p>
          <h1
            className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]"
            style={{ color: WEB.textPrimary }}
          >
            {title}
          </h1>
          {meta && (
            <p className="mt-3 text-sm md:text-[15px]" style={{ color: WEB.textMuted }}>
              {meta}
            </p>
          )}
          {lede && (
            <p
              className="mt-5 text-base md:text-[17px] leading-[1.7] max-w-2xl"
              style={{ color: WEB.textBody }}
            >
              {lede}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </motion.section>
  );
}

/** KPI grid — 3–5 metrics, spacious, display-sized values. */
export interface KpiItem {
  value: string;
  label: string;
  color?: string;
  sub?: string;
}
export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8">
      <div
        className="grid gap-px rounded-2xl overflow-hidden border"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          backgroundColor: WEB.borderDefault,
          borderColor: WEB.borderDefault,
        }}
      >
        {items.map((k, i) => (
          <div
            key={i}
            className="p-5 md:p-7 flex flex-col gap-2"
            style={{ backgroundColor: WEB.surfaceRaised }}
          >
            <div
              className="text-2xl md:text-4xl font-bold tracking-tight tabular-nums leading-none"
              style={{ color: k.color || WEB.textPrimary }}
            >
              {k.value}
            </div>
            <div
              className="text-[10px] md:text-[11px] font-mono uppercase tracking-[0.16em]"
              style={{ color: WEB.textSubtle }}
            >
              {k.label}
            </div>
            {k.sub && (
              <div className="text-xs mt-1" style={{ color: WEB.textMuted }}>
                {k.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Section label — mono uppercase, precedes each Card. */
export function SectionLabel({
  children,
  accent = "green",
  right,
}: {
  children: ReactNode;
  accent?: Accent;
  right?: ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 mt-10 md:mt-14 mb-3 flex items-center">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: accentHex[accent] }}
      >
        {children}
      </p>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/** Card — dark surface, rounded, bordered, generous padding. */
export function Card({
  children,
  padding = "p-6 md:p-8",
  className = "",
}: {
  children: ReactNode;
  padding?: string;
  className?: string;
}) {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8">
      <div
        className={`rounded-2xl border ${padding} ${className}`}
        style={{ backgroundColor: WEB.surface, borderColor: WEB.borderDefault }}
      >
        {children}
      </div>
    </div>
  );
}

/** Thermometer — ARR progress toward target. Used on client detail page. */
export function Thermometer({
  value,
  target,
  accent = "green",
}: {
  value: number;
  target: number;
  accent?: Accent;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const acc = accentHex[accent];
  return (
    <div className="w-full max-w-xl">
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-3xl md:text-4xl font-bold tracking-tight tabular-nums"
          style={{ color: acc }}
        >
          {fmtMoney(value)}
        </span>
        <span className="text-sm" style={{ color: WEB.textMuted }}>
          of {fmtMoney(target)}
        </span>
        <span
          className="ml-auto text-xs font-mono uppercase tracking-[0.14em]"
          style={{ color: WEB.textSubtle }}
        >
          {pct}% complete
        </span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: WEB.borderDefault }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${acc} 0%, ${acc} 70%, ${accentHex.cyan} 100%)`,
          }}
        />
      </div>
    </div>
  );
}

/** Lightweight SVG sparkline for inline trend display. */
export function SparkArea({
  points,
  accent = "green",
  height = 140,
}: {
  points: number[];
  accent?: Accent;
  height?: number;
}) {
  const acc = accentHex[accent];
  if (!points || points.length < 2) {
    return (
      <div
        style={{ height, backgroundColor: WEB.surfaceRaised }}
        className="rounded-lg"
      />
    );
  }
  const W = 600;
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = max - min || 1;
  const coords = points
    .map(
      (v, i) =>
        `${((i / (points.length - 1)) * W).toFixed(1)},${(height - ((v - min) / range) * (height - 24) - 12).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={acc} stopOpacity={0.3} />
          <stop offset="100%" stopColor={acc} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${coords} ${W},${height}`} fill={`url(#spark-${accent})`} />
      <polyline
        points={coords}
        fill="none"
        stroke={acc}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Pill badge — severity, tag, kind. */
export function PillBadge({
  children,
  accent = "green",
  solid = false,
}: {
  children: ReactNode;
  accent?: Accent;
  solid?: boolean;
}) {
  const acc = accentHex[accent];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.12em]"
      style={{
        backgroundColor: solid ? acc : `${acc}14`,
        color: solid ? "#05050a" : acc,
        border: solid ? "none" : `1px solid ${acc}33`,
      }}
    >
      {children}
    </span>
  );
}

/** Primary / secondary CTA row. */
export function CtaRow({
  primary,
  secondary,
  accent = "green",
}: {
  primary: { label: string; onClick?: () => void; href?: string };
  secondary?: { label: string; onClick?: () => void; href?: string };
  accent?: Accent;
}) {
  const acc = accentHex[accent];
  const P = primary.href ? "a" : "button";
  const S = secondary?.href ? "a" : "button";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <P
        href={primary.href}
        onClick={primary.onClick}
        className="inline-flex items-center justify-center px-5 md:px-6 h-11 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: acc, color: "#05050a" }}
      >
        {primary.label}
      </P>
      {secondary && (
        <S
          href={secondary.href}
          onClick={secondary.onClick}
          className="inline-flex items-center justify-center px-5 md:px-6 h-11 rounded-xl text-sm font-semibold border transition-colors"
          style={{
            borderColor: WEB.borderStrong,
            color: WEB.textBody,
            backgroundColor: "transparent",
          }}
        >
          {secondary.label}
        </S>
      )}
    </div>
  );
}

/** Footer — tagline + links. Always present on every linked-from-email page. */
export function PageFooter({
  tagline,
  links,
}: {
  tagline: string;
  links?: Array<{ label: string; href: string }>;
}) {
  return (
    <footer
      className="mt-16 md:mt-24 border-t py-10"
      style={{ borderColor: WEB.borderDefault }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 text-center space-y-3">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.2em]"
          style={{ color: WEB.textSubtle }}
        >
          {tagline}
        </p>
        {links && links.length > 0 && (
          <p className="text-xs" style={{ color: WEB.textMuted }}>
            {links.map((l, i) => (
              <span key={l.href}>
                <a href={l.href} className="underline underline-offset-4 hover:opacity-80">
                  {l.label}
                </a>
                {i < links.length - 1 && (
                  <span style={{ color: WEB.textSubtle }}> · </span>
                )}
              </span>
            ))}
          </p>
        )}
      </div>
    </footer>
  );
}
