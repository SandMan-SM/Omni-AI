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
import { Loader2, Building2, ArrowRight } from "lucide-react";
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
      <PageShell accent="purple">
        <PageTopBar label="Sponsor portal" accent="purple" />
        <PageHero
          eyebrow="Sponsor portal"
          title="No active sponsorships yet"
          meta={`Signed in as ${user.email}`}
          lede="Once a sponsorship is attached to your email, this page will show every business you're funding with live build-log activity — content shipped, deals closed, metrics moving."
          accent="purple"
          right={
            <CtaRow
              primary={{ label: "Apply to sponsor", href: "/sponsor/application" }}
              secondary={{ label: "How sponsorship works", href: "/sponsor/info" }}
              accent="purple"
            />
          }
        />
        <PageFooter
          tagline="Omni AI · Sponsor Program"
          links={[
            { label: "Sponsor info", href: "/sponsor/info" },
            { label: "Apply", href: "/sponsor/application" },
          ]}
        />
      </PageShell>
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
