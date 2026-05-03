"use client";
export const dynamic = "force-dynamic";
/**
 * Sponsor portal — real data only. Pulls from /api/sponsor/overview which
 * reads the `sponsorships` table + `build_log` for live activity on
 * sponsored clients. No mocks, no placeholder numbers.
 *
 * Design contract: docs/web-design-system.md. Accent: purple.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { Loader2, Building2, ArrowRight, LayoutDashboard, BookOpen, BarChart3, Sparkles, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  PageShell,
  PageTopBar,
  PageHero,
  KpiGrid,
  SectionLabel,
  Card,
  PillBadge,
  CtaRow,
  PageFooter,
  WEB,
  fmtMoney,
} from "@/components/ui/web-primitives";
import { PinkSparksBackdrop } from "@/components/pink-sparks-backdrop";

interface Ship {
  title: string;
  kind: string;
  detail: string | null;
  unlocks: string | null;
  created_at: string;
}
interface SponsoredClient {
  sponsorship_id: string;
  sponsor_name: string;
  amount_usd: number;
  cadence: string;
  started_at: string;
  client: {
    slug: string;
    name: string;
    emoji: string;
    mrr_usd: number;
    arr_usd: number;
    status: string;
  };
  ships_30d: number;
  ships_by_kind: Record<string, number>;
  recent_ships: Ship[];
}
interface OverviewPayload {
  authorized: boolean;
  sponsor?: string;
  sponsorships: SponsoredClient[];
  totals: { funded_usd: number; client_count: number; ships_30d: number } | null;
}

const tAgo = (d: string) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000),
    h = Math.floor(m / 60),
    dy = Math.floor(h / 24);
  return dy > 0 ? `${dy}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now";
};

export default function SponsorPortal() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sponsor/overview", { credentials: "include" });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) load();
    const iv = setInterval(() => load(), 20000);
    return () => clearInterval(iv);
  }, [authLoading, load]);

  if (authLoading || loading)
    return (
      <PageShell accent="purple">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: WEB.purple }} />
        </div>
      </PageShell>
    );

  if (!user) {
    return (
      <PageShell accent="purple">
        <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center gap-5">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: WEB.textPrimary }}>
            Sign in to view your sponsor portal
          </h1>
          <p className="text-base max-w-lg" style={{ color: WEB.textMuted }}>
            The portal shows every business you&apos;re sponsoring and the real activity
            happening on each one — ships, content, deals — pulled live.
          </p>
          <CtaRow
            primary={{ label: "Sign in", href: "/?signin=true" }}
            secondary={{ label: "Learn about sponsoring", href: "/sponsor/info" }}
            accent="purple"
          />
        </div>
      </PageShell>
    );
  }

  if (!data?.authorized || !data?.sponsorships?.length) {
    return (
      <div className="min-h-screen text-white relative">
        {/* Pink sparks backdrop — bypasses PageShell so the canvas
            doesn't sit opaque on top of the fixed-position canvas. */}
        <PinkSparksBackdrop />
        <PageTopBar label="Sponsor portal" accent="purple" />

        {/* Custom hero — title fits one row, lede spans full width,
            CTAs sit under the paragraph (not floating on the right). */}
        <section className="max-w-6xl mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-8 md:pb-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] mb-3 text-purple-300">
            Sponsor portal
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.02] text-white mb-3">
            No active sponsorships yet
          </h1>
          <p className="text-sm md:text-[15px] text-gray-400 mb-6">
            Signed in as {user.email}
          </p>
          <p className="text-base md:text-[17px] leading-[1.7] text-gray-300 mb-8">
            Once a sponsorship is attached to your email, every business you&apos;re funding shows up here — live build-log activity, content shipped, deals closed, metrics moving in real time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-sm md:text-base transition shadow-lg shadow-purple-900/30"
            >
              Open agentic dashboard
            </Link>
            <Link
              href="/sponsor/info"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-purple-400/40 hover:border-purple-300/70 hover:bg-purple-500/[0.08] text-purple-100 hover:text-white font-semibold text-sm md:text-base transition"
            >
              Learn more
            </Link>
          </div>
        </section>

        {/* Where sponsor info lives + what each surface shows. Empty
            state shouldn't be a dead end — give the user a clear map
            of every surface that shows funded-business activity. */}
        <section className="max-w-6xl mx-auto px-5 md:px-8 pt-6 md:pt-10 pb-10 md:pb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
            Where you&apos;ll see your sponsorships
          </h2>
          <p className="text-sm md:text-base text-gray-400 mb-8 max-w-3xl">
            Six surfaces feed the same live data. Each card explains what shows up, the moment a sponsorship attaches.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                Icon: LayoutDashboard,
                title: "This page (Sponsor portal)",
                body: "Every funded business in one list. Cards link into the build-log, the partner page, and the daily activity feed for that workspace.",
              },
              {
                Icon: BarChart3,
                title: "Agentic Dashboard",
                body: "Live KPIs across every business in the program: leads this week, messages sent, conversion rate, revenue impact. Switch workspaces from the picker.",
              },
              {
                Icon: Sparkles,
                title: "Co-branded partner pages",
                body: "omnileadsagi.com/partners/<slug> for each business. Share-ready, indexable, with the full \"what we run for them\" breakdown.",
              },
              {
                Icon: BookOpen,
                title: "Newsletter engine",
                body: "Drafts and published posts per workspace, scoped to the businesses you sponsor. Track opens, clicks, and unsubscribes per send.",
              },
              {
                Icon: Building2,
                title: "Sponsor info page",
                body: "Full program brief: what gets built, who it's for, how impact is measured. The page you'd send a fellow operator to apply.",
              },
              {
                Icon: Mail,
                title: "Weekly sponsor digest",
                body: "Every Monday: which sponsored businesses moved, what shipped, what's queued. Lands in your inbox automatically once a sponsorship is active.",
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] hover:border-purple-500/30 hover:bg-purple-500/[0.04] transition p-6 backdrop-blur-sm"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/25 to-pink-500/15 border border-purple-500/30 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-purple-200" />
                </div>
                <h3 className="font-semibold text-white text-base md:text-lg mb-2 leading-tight">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live preview — what the dashboard looks like once a sponsorship
            is attached. Same image used on /sponsor/info so the flow stays
            visually consistent. */}
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-12 md:pb-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
            What it looks like once active
          </h2>
          <p className="text-sm md:text-base text-gray-400 mb-6 max-w-3xl">
            Every metric, every agent, every shipped post for each business you sponsor — surfaced the moment a sponsorship is attached to your email. No setup required on your end.
          </p>
          <div className="rounded-xl md:rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl shadow-purple-900/30">
            <Image
              src="/dashboard-screenshot.png"
              alt="Omni AI Agentic Dashboard preview — KPIs, asset analytics, AI agent stats per sponsored business"
              width={1200}
              height={675}
              className="w-full h-auto block"
              priority
            />
          </div>
        </section>

        {/* Closing CTA card */}
        <section className="max-w-6xl mx-auto px-5 md:px-8 pb-14 md:pb-20">
          <div className="rounded-2xl md:rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-fuchsia-500/[0.04] to-transparent p-7 md:p-10 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
                  Ready to see the agentic stack in motion?
                </h2>
                <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                  Open the dashboard to see live activity across every workspace, or read the full program breakdown to learn how sponsorship slots get filled.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold text-sm md:text-base transition shadow-lg shadow-purple-900/30"
                >
                  Open agentic dashboard
                </Link>
                <Link
                  href="/sponsor/info"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-purple-400/40 hover:border-purple-300/70 hover:bg-purple-500/[0.08] text-purple-100 hover:text-white font-semibold text-sm md:text-base transition"
                >
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>

        <PageFooter
          tagline="Omni AI · Sponsor Program"
          links={[
            { label: "Sponsor info", href: "/sponsor/info" },
            { label: "Apply", href: "/sponsor/application" },
          ]}
        />
      </div>
    );
  }

  const t = data.totals!;
  const sponsorLabel = data.sponsorships[0]?.sponsor_name || data.sponsor || "Sponsor";

  return (
    <PageShell accent="purple">
      <PageTopBar
        label={`Sponsor · ${sponsorLabel}`}
        accent="purple"
        right={
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs font-mono uppercase tracking-[0.16em] hover:opacity-80"
            style={{ color: WEB.textMuted }}
          >
            Dashboard
          </button>
        }
      />

      <PageHero
        eyebrow="Sponsor portal · live"
        title={`${sponsorLabel}`}
        meta={`${t.client_count} sponsored ${t.client_count === 1 ? "business" : "businesses"} · ${t.ships_30d} ships in the last 30 days`}
        lede="Every dollar you've put in is attached to a real business with a public build log. Scroll down to see what's shipped this month on each one."
        accent="purple"
      />

      <KpiGrid
        items={[
          { value: fmtMoney(t.funded_usd), label: "Funded to date", color: WEB.purple },
          { value: String(t.client_count), label: "Businesses sponsored" },
          { value: String(t.ships_30d), label: "Ships · 30d", color: WEB.purple },
          {
            value: t.client_count ? fmtMoney(Math.round(t.funded_usd / t.client_count)) : "$0",
            label: "Avg per business",
          },
        ]}
      />

      <SectionLabel accent="purple">Sponsored businesses</SectionLabel>
      <div className="max-w-6xl mx-auto px-5 md:px-8 space-y-4">
        {data.sponsorships.map((s, i) => (
          <motion.div
            key={s.sponsorship_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: WEB.surface, borderColor: WEB.borderDefault }}
          >
            <div
              className="flex flex-wrap items-start gap-4 p-6 md:p-8 border-b"
              style={{ borderColor: WEB.borderDefault }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: WEB.surfaceRaised, border: `1px solid ${WEB.borderDefault}` }}
              >
                {s.client.emoji}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-xl md:text-2xl font-semibold" style={{ color: WEB.textPrimary }}>
                    {s.client.name}
                  </h3>
                  <PillBadge accent="purple">{s.cadence.replace("_", " ")}</PillBadge>
                </div>
                <p className="text-sm" style={{ color: WEB.textMuted }}>
                  Sponsored since{" "}
                  {new Date(s.started_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="text-right">
                <div
                  className="text-2xl md:text-3xl font-bold tabular-nums"
                  style={{ color: WEB.purple }}
                >
                  {fmtMoney(s.amount_usd)}
                </div>
                <div
                  className="text-[11px] font-mono uppercase tracking-[0.14em]"
                  style={{ color: WEB.textSubtle }}
                >
                  Funded
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 divide-x border-b"
              style={{
                borderColor: WEB.borderDefault,
                ["--tw-divide-opacity" as any]: 1,
              }}
            >
              {[
                { label: "Ships · 30d", value: String(s.ships_30d) },
                { label: "MRR", value: fmtMoney(s.client.mrr_usd) },
                { label: "ARR", value: fmtMoney(s.client.arr_usd) },
                { label: "Status", value: s.client.status },
              ].map((stat, j) => (
                <div
                  key={j}
                  className="p-4 md:p-5"
                  style={{ borderColor: WEB.borderDefault }}
                >
                  <div
                    className="text-lg md:text-xl font-semibold tabular-nums"
                    style={{ color: WEB.textPrimary }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-[10px] md:text-[11px] font-mono uppercase tracking-[0.14em] mt-1"
                    style={{ color: WEB.textSubtle }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent ships */}
            <div className="p-4 md:p-6">
              <p
                className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3"
                style={{ color: WEB.purple }}
              >
                Recent ships · last 30 days
              </p>
              {s.recent_ships.length === 0 ? (
                <p className="text-sm py-4" style={{ color: WEB.textMuted }}>
                  No ships logged in the last 30 days on this business yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {s.recent_ships.map((ship, k) => (
                    <div
                      key={k}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: WEB.surfaceRaised }}
                    >
                      <div className="pt-0.5">
                        <PillBadge accent="purple">{ship.kind}</PillBadge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: WEB.textPrimary }}
                        >
                          {ship.title}
                        </p>
                        {ship.detail && (
                          <p
                            className="text-xs mt-1 leading-relaxed"
                            style={{ color: WEB.textMuted }}
                          >
                            {ship.detail}
                          </p>
                        )}
                        {ship.unlocks && (
                          <p
                            className="text-[11px] mt-1 font-mono"
                            style={{ color: WEB.purple }}
                          >
                            → unlocks: {ship.unlocks}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-mono shrink-0"
                        style={{ color: WEB.textSubtle }}
                      >
                        {tAgo(ship.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 mt-12 flex justify-center">
        <CtaRow
          primary={{ label: "Book a strategy call", href: "/book-now" }}
          secondary={{ label: "Add another sponsorship", href: "/sponsor/application" }}
          accent="purple"
        />
      </div>

      <PageFooter
        tagline="Omni AI · Sponsor Program"
        links={[
          { label: "Sponsor info", href: "/sponsor/info" },
          { label: "Apply", href: "/sponsor/application" },
          { label: "Book a call", href: "/book-now" },
        ]}
      />
    </PageShell>
  );
}
