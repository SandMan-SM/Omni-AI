"use client";
export const dynamic = "force-dynamic";
/**
 * Client detail page — landing target for Weekly Investor Review emails.
 * Contract: docs/web-design-system.md. All layout via components/ui/web-primitives.
 * Any edit that bypasses the primitives is a regression — see the locked artifact.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import {
  PageShell,
  PageTopBar,
  PageHero,
  KpiGrid,
  SectionLabel,
  Card,
  Thermometer,
  SparkArea,
  PillBadge,
  CtaRow,
  PageFooter,
  WEB,
  fmtMoney,
} from "@/components/ui/web-primitives";

const tAgo = (d: string) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000),
    h = Math.floor(m / 60),
    dy = Math.floor(h / 24);
  return dy > 0 ? `${dy}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now";
};

export default function ClientDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const { user, loading: authLoading } = useAuth();
  const { profileLoading, isAdmin } = useProfile();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [genReview, setGenReview] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await fetch(`/api/portfolio/client/${slug}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  if (authLoading || profileLoading || loading)
    return (
      <PageShell>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: WEB.green }} />
        </div>
      </PageShell>
    );
  if (!user || !isAdmin)
    return (
      <PageShell accent="red">
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm font-mono" style={{ color: WEB.red }}>
            Admin only
          </p>
        </div>
      </PageShell>
    );
  if (!data?.client)
    return (
      <PageShell>
        <div className="p-8" style={{ color: WEB.textMuted }}>
          Client not found.
        </div>
      </PageShell>
    );

  const c = data.client;
  const metrics = data.metrics || [];
  const ships = data.ships || [];
  const risks = data.risks || [];
  const mrrSeries = metrics.map((m: any) => m.mrr_usd || 0);
  const target = c.arr_target_usd || 1_000_000;
  const progressPct = Math.min(100, Math.round(((c.current_arr_usd || 0) / target) * 100));
  const openRisks = risks.filter((r: any) => !r.resolved_at);

  const openReview = () => {
    setGenReview(true);
    window.open(`/api/portfolio/review/${slug}`, "_blank");
    setTimeout(() => setGenReview(false), 1200);
  };

  return (
    <PageShell accent="green">
      <PageTopBar
        label={`Client · ${c.slug}`}
        accent="green"
        right={
          <Link
            href="/command"
            className="inline-flex items-center gap-2 text-xs font-mono hover:opacity-80"
            style={{ color: WEB.textMuted }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to command
          </Link>
        }
      />

      <PageHero
        eyebrow={`${c.emoji || "📦"} Investor-grade client view`}
        title={c.name}
        meta={`Stack: ${c.stack || "—"} · Status: ${c.status} · Target: ${fmtMoney(target)} ARR`}
        lede={c.notes || undefined}
        accent="green"
        right={
          <div className="flex flex-col gap-3">
            <CtaRow
              primary={{ label: genReview ? "Opening…" : "Generate review PDF", onClick: openReview }}
              secondary={{ label: "Raw JSON", href: `/api/portfolio/review/${slug}?format=json` }}
              accent="green"
            />
            <div className="flex items-center gap-2 justify-end">
              <FileText className="w-3.5 h-3.5" style={{ color: WEB.textSubtle }} />
              <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: WEB.textSubtle }}>
                Investor-ready HTML
              </span>
            </div>
          </div>
        }
      />

      {/* Thermometer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="max-w-6xl mx-auto px-5 md:px-8 mb-8"
      >
        <div
          className="rounded-2xl border p-6 md:p-8"
          style={{ backgroundColor: WEB.surfaceRaised, borderColor: WEB.borderDefault }}
        >
          <p
            className="text-[11px] font-mono uppercase tracking-[0.18em] mb-4"
            style={{ color: WEB.green }}
          >
            Progress to ${(target / 1_000_000).toFixed(1)}M ARR
          </p>
          <Thermometer value={c.current_arr_usd || 0} target={target} accent="green" />
        </div>
      </motion.div>

      {/* KPI strip */}
      <KpiGrid
        items={[
          { value: fmtMoney(c.current_arr_usd || 0), label: "ARR", color: WEB.green },
          { value: fmtMoney(c.current_mrr_usd || 0), label: "MRR", color: WEB.cyan },
          { value: String(c.customer_count || 0), label: "Customers" },
          { value: String(ships.length), label: "Ships · 90d" },
          { value: String(openRisks.length), label: "Open risks", color: openRisks.length ? WEB.red : WEB.green },
        ]}
      />

      {/* MRR trajectory */}
      <SectionLabel accent="green">90-day MRR trajectory</SectionLabel>
      <Card>
        <SparkArea points={mrrSeries} accent="green" height={180} />
        <div className="flex justify-between mt-3">
          <span className="text-xs font-mono" style={{ color: WEB.textSubtle }}>
            {metrics[0]?.date || "—"}
          </span>
          <span className="text-xs font-mono" style={{ color: WEB.textSubtle }}>
            {metrics[metrics.length - 1]?.date || "—"}
          </span>
        </div>
      </Card>

      {/* Open risks */}
      <SectionLabel accent={openRisks.length ? "red" : "green"}>Open risks</SectionLabel>
      <Card padding="p-4 md:p-5">
        {openRisks.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: WEB.green }}>
            🟢 No open risks. Ship into the open field.
          </p>
        ) : (
          <div className="space-y-3">
            {openRisks.map((r: any, i: number) => {
              const sevAccent = r.severity === "red" ? "red" : "amber";
              const sevHex = r.severity === "red" ? WEB.red : WEB.amber;
              return (
                <div
                  key={i}
                  className="rounded-xl p-4 md:p-5 border-l-[3px]"
                  style={{
                    backgroundColor: r.severity === "red" ? "#2d1215" : "#2a1f0a",
                    borderLeftColor: sevHex,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <PillBadge accent={sevAccent}>severity · {r.severity}</PillBadge>
                        <span className="text-[11px] font-mono" style={{ color: WEB.textSubtle }}>
                          opened {tAgo(r.opened_at)} ago
                        </span>
                      </div>
                      <p className="text-sm md:text-base font-semibold" style={{ color: WEB.textPrimary }}>
                        {r.title}
                      </p>
                      {r.detail && (
                        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: WEB.textBody }}>
                          {r.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Ship timeline */}
      <SectionLabel accent="green" right={
        <span className="text-[11px] font-mono" style={{ color: WEB.textSubtle }}>
          {ships.length} total
        </span>
      }>
        Ship timeline · last 90 days
      </SectionLabel>
      <Card padding="p-2 md:p-3">
        {ships.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: WEB.textMuted }}>
            No ships in window — go build.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: WEB.borderDefault }}>
            {ships
              .slice()
              .reverse()
              .slice(0, 40)
              .map((s: any, i: number) => (
                <div key={s.id || i} className="flex items-start gap-4 px-4 md:px-5 py-4" style={{ borderColor: WEB.borderDefault }}>
                  <div className="shrink-0 pt-0.5">
                    <PillBadge accent="green">{s.kind}</PillBadge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-[15px] font-semibold" style={{ color: WEB.textPrimary }}>
                      {s.title}
                    </p>
                    {s.detail && (
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: WEB.textMuted }}>
                        {s.detail}
                      </p>
                    )}
                    {s.unlocks && (
                      <p className="text-xs mt-1.5 font-mono" style={{ color: WEB.green }}>
                        → unlocks: {s.unlocks}
                      </p>
                    )}
                    {s.file_paths?.length > 0 && (
                      <p className="text-[11px] font-mono mt-1.5 truncate" style={{ color: WEB.textSubtle }}>
                        {s.file_paths.join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-mono tabular-nums"
                    style={{ color: WEB.textSubtle }}
                  >
                    {tAgo(s.created_at)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* CTA band */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 mt-12 flex justify-center">
        <CtaRow
          primary={{ label: "Open Command Center", href: "/command" }}
          secondary={{ label: "Book a working session", href: "/book-now" }}
          accent="green"
        />
      </div>

      <PageFooter
        tagline="Omni AI · Portfolio Review"
        links={[
          { label: "Command Center", href: "/command" },
          { label: "Book a session", href: "/book-now" },
        ]}
      />
    </PageShell>
  );
}
