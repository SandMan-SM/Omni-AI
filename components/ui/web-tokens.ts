/**
 * OMNI AI — pure design tokens (server-safe).
 *
 * Why a separate file from `web-primitives.tsx`?
 * `web-primitives.tsx` is `"use client"` because its components use
 * framer-motion. When a server component imports named exports from a
 * client module, Next.js replaces the module with a client reference
 * proxy. Reading plain data constants off that proxy at SSR time hits a
 * temporal-dead-zone error ("Cannot access amber before initialization").
 *
 * So: every plain data export (tokens, helpers) lives here, and both
 * server components AND `web-primitives.tsx` import from this file.
 * Never add "use client" to this module.
 */

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
