// /federation/case-studies — index of all federation case studies.

import type { Metadata } from "next";
import Link from "next/link";
import CaseCosmicBackground from "@/components/case-study/CaseCosmicBackground";
import CaseStudyGate from "@/components/case-study/CaseStudyGate";
import { CASE_STUDIES } from "@/lib/case-studies";

export const dynamic = "force-static";

const SITE_URL = "https://omnileadsagi.com";

export const metadata: Metadata = {
  title: "Federation Case Studies · Infrastructure · Development · Omni AI",
  description: "Every federation node. What was built, what it costs, what the AI CEO does for it, and live metrics from Supabase per request.",
  alternates: { canonical: `${SITE_URL}/federation/case-studies` },
  openGraph: {
    title: "Federation Case Studies",
    description: "Every federation node — build inventory, agentic stack, live metrics, pricing.",
    url: `${SITE_URL}/federation/case-studies`,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  live: { bg: "rgba(45,220,168,0.16)", fg: "#2ddca8", label: "LIVE" },
  in_progress: { bg: "rgba(88,200,255,0.16)", fg: "#58c8ff", label: "IN PROGRESS" },
  scaffold: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "SCAFFOLD" },
  forthcoming: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "FORTHCOMING" },
  archived: { bg: "rgba(115,115,115,0.16)", fg: "#a3a3a3", label: "ARCHIVED" },
};

const REALM_LABEL: Record<number, string> = {
  1: "Realm I · Site",
  2: "Realm II · HQ",
  3: "Realm III · Interlinked",
};

export default function CaseStudyIndex() {
  // Personal Branding cluster — the operator + mastermind + builder + channel
  // partner that together represent "the personal-brand surfaces."
  const personalBrandingSlugs = new Set([
    "sitani-mafi",
    "imperium",
    "rene-laveau",
    "live-better-on-the-drip",
  ]);

  const grouped = {
    HQ: CASE_STUDIES.filter((c) => c.realm === 2),
    "Personal Branding": personalBrandingSlugs
      ? CASE_STUDIES.filter((c) => personalBrandingSlugs.has(c.slug))
      : [],
    Operators: CASE_STUDIES.filter(
      (c) => c.realm === 1 && c.role.includes("Operator") && !personalBrandingSlugs.has(c.slug),
    ),
    Newsrooms: CASE_STUDIES.filter((c) => c.role === "Newsroom"),
    Funnels: CASE_STUDIES.filter((c) =>
      [
        "Public Pantheon spectator",
        "Leifson satellite · GEO funnel",
        "Federation merch",
        "Omni AI case-study funnel",
        "Branded short-link redirect",
      ].includes(c.role),
    ),
    Pending: CASE_STUDIES.filter(
      (c) =>
        (c.status === "in_progress" || c.status === "forthcoming") &&
        !personalBrandingSlugs.has(c.slug),
    ),
  };

  return (
    <CaseStudyGate>
      <CaseCosmicBackground />
      <main className="min-h-screen text-zinc-100 relative z-10">
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
              Infrastructure · Development
            </p>
            <h1 className="mt-3 text-5xl sm:text-7xl tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
              Federation case studies.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-400">
              Every node in the federation — what was built, what it costs, what the AI CEO does for it,
              and live metrics from Supabase pulled at request time. {CASE_STUDIES.length} entries total.
            </p>
          </div>
        </section>

        {Object.entries(grouped).map(([groupName, items]) => {
          if (items.length === 0) return null;
          return (
            <section key={groupName} className="mx-auto max-w-6xl px-6 py-12">
              <p className="text-xs uppercase tracking-[0.4em] text-amber-400 mb-6">{groupName}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => {
                  const status = STATUS_BADGE[c.status] || STATUS_BADGE.live;
                  return (
                    <Link
                      key={c.slug}
                      href={`/federation/case-studies/${c.slug}`}
                      className="block rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-6 hover:border-amber-400 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xl" style={{ fontFamily: "Georgia, serif" }}>{c.brand}</p>
                        <span
                          className="text-[10px] font-bold tracking-[0.28em] uppercase px-2 py-1 rounded shrink-0"
                          style={{ background: status.bg, color: status.fg }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.28em] text-zinc-500">
                        {c.role} · {REALM_LABEL[c.realm]}
                      </p>
                      <p className="mt-3 text-sm text-zinc-400 leading-relaxed line-clamp-3">
                        {c.tagline}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">{c.domain}</span>
                        <span className="text-amber-400">{c.buildPriceRange}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </CaseStudyGate>
  );
}
