import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronOrAdmin } from "@/lib/api-auth";
import { CLIENT_AGENT_REGISTRY } from "@/lib/client-agent-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AssetStatus = "compounding" | "ready-to-upgrade" | "attention-needed" | "leaking";

type PortfolioClient = {
  slug: string;
  name?: string | null;
  current_arr_usd?: number | null;
  current_mrr_usd?: number | null;
  arr_target_usd?: number | null;
};

type BuildLogRow = {
  client_slug: string | null;
  title: string | null;
  kind: string | null;
  created_at: string;
};

type RiskRow = {
  client_slug: string | null;
  severity: string | null;
  title: string | null;
};

type LedgerRow = {
  target_id: string | null;
  target_kind: string | null;
  action: string | null;
  payload: unknown;
  created_at: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function rowMatchesClient(row: LedgerRow, slug: string) {
  const haystack = [
    row.target_id,
    row.target_kind,
    row.action,
    typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload ?? {}),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(slug.toLowerCase());
}

export async function GET(req: NextRequest) {
  noStore();
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const [clientsRes, shipsRes, risksRes, defectsRes] = await Promise.all([
    supabase.from("client_portfolio").select("slug, name, current_arr_usd, current_mrr_usd, arr_target_usd"),
    supabase
      .from("build_log")
      .select("client_slug, title, kind, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("client_risks")
      .select("client_slug, severity, title")
      .is("resolved_at", null),
    supabase
      .from("hades_root_audit")
      .select("target_id, target_kind, action, payload, created_at")
      .eq("result", "failure")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const sourceErrors = [
    clientsRes.error ? `client_portfolio: ${clientsRes.error.message}` : null,
    shipsRes.error ? `build_log: ${shipsRes.error.message}` : null,
    risksRes.error ? `client_risks: ${risksRes.error.message}` : null,
    defectsRes.error ? `hades_root_audit: ${defectsRes.error.message}` : null,
  ].filter(Boolean);

  if (clientsRes.error) {
    return NextResponse.json(
      { error: "Could not load the asset portfolio.", source_errors: sourceErrors },
      { status: 500 },
    );
  }

  const clients = (clientsRes.data ?? []) as PortfolioClient[];
  const ships = (shipsRes.data ?? []) as BuildLogRow[];
  const risks = (risksRes.data ?? []) as RiskRow[];
  const defects = (defectsRes.data ?? []) as LedgerRow[];
  const clientBySlug = new Map(clients.map((client) => [client.slug, client]));

  const assets = CLIENT_AGENT_REGISTRY.map((entry) => {
    const client = clientBySlug.get(entry.slug);
    const dataKeys = Object.keys(entry.dataConnections);
    const dataValues = Object.values(entry.dataConnections);
    const connectedConnections = dataValues.filter((value) => value === "connected").length;
    const missingConnections = dataValues
      .map((value, index) => ({ value, key: dataKeys[index] }))
      .filter((item) => item.value !== "connected")
      .map((item) => item.key);

    const openRisks = risks.filter((risk) => risk.client_slug === entry.slug);
    const redRisks = openRisks.filter((risk) => risk.severity === "red").length;
    const yellowRisks = openRisks.filter((risk) => risk.severity === "yellow").length;
    const recentDefects = defects.filter((defect) => rowMatchesClient(defect, entry.slug)).length;
    const lastShip = ships.find((ship) => ship.client_slug === entry.slug) ?? null;
    const shipAge = daysSince(lastShip?.created_at);
    const arrTarget = client?.arr_target_usd ?? 1_000_000;
    const progressPct = arrTarget > 0 ? clamp(Math.round(((client?.current_arr_usd ?? 0) / arrTarget) * 100), 0, 100) : 0;

    const tierBonus = entry.tier === "tier_1_ai_ceo" ? 8 : entry.tier === "internal_growth" ? 6 : 2;
    const shipBonus = shipAge == null ? -8 : shipAge <= 7 ? 10 : shipAge <= 30 ? 5 : shipAge <= 90 ? 0 : -8;
    const score = clamp(
      62 +
        tierBonus +
        connectedConnections * 4 +
        Math.min(12, Math.round(progressPct / 8)) +
        shipBonus -
        missingConnections.length * 4 -
        redRisks * 18 -
        yellowRisks * 8 -
        recentDefects * 6,
      0,
      100,
    );

    const status: AssetStatus =
      redRisks > 0 || recentDefects >= 3
        ? "leaking"
        : score >= 82
          ? "compounding"
          : missingConnections.length >= 3 || yellowRisks > 0
            ? "attention-needed"
            : "ready-to-upgrade";

    return {
      slug: entry.slug,
      name: client?.name ?? entry.businessName,
      agentName: entry.agentName,
      tier: entry.tier,
      priority: entry.priority,
      serviceArea: entry.serviceArea,
      score,
      status,
      revenueMove: entry.revenueMove,
      nextAction: redRisks > 0 ? openRisks.find((risk) => risk.severity === "red")?.title ?? entry.nextAction : entry.nextAction,
      websitePath: entry.websitePath,
      aiCeoPath: entry.aiCeoPath,
      currentArrUsd: client?.current_arr_usd ?? 0,
      currentMrrUsd: client?.current_mrr_usd ?? 0,
      progressPct,
      connectedConnections,
      missingConnections,
      openRisks: { red: redRisks, yellow: yellowRisks, total: openRisks.length },
      recentDefects,
      lastShip: lastShip
        ? {
            title: lastShip.title,
            kind: lastShip.kind,
            createdAt: lastShip.created_at,
            ageDays: shipAge,
          }
        : null,
    };
  });

  const statusWeight: Record<AssetStatus, number> = {
    compounding: 0,
    "ready-to-upgrade": 1,
    "attention-needed": 2,
    leaking: 3,
  };
  const sortedAssets = assets.sort((a, b) => {
    const statusDelta = statusWeight[b.status] - statusWeight[a.status];
    if (statusDelta !== 0) return statusDelta;
    return a.score - b.score || a.priority - b.priority;
  });
  const total = sortedAssets.length || 1;

  return NextResponse.json({
    fetched_at: new Date().toISOString(),
    source_errors: sourceErrors,
    summary: {
      total_assets: sortedAssets.length,
      average_score: Math.round(sortedAssets.reduce((sum, asset) => sum + asset.score, 0) / total),
      compounding: sortedAssets.filter((asset) => asset.status === "compounding").length,
      ready_to_upgrade: sortedAssets.filter((asset) => asset.status === "ready-to-upgrade").length,
      attention_needed: sortedAssets.filter((asset) => asset.status === "attention-needed").length,
      leaking: sortedAssets.filter((asset) => asset.status === "leaking").length,
      missing_connections: sortedAssets.reduce((sum, asset) => sum + asset.missingConnections.length, 0),
      recent_defects: sortedAssets.reduce((sum, asset) => sum + asset.recentDefects, 0),
    },
    assets: sortedAssets,
  });
}
