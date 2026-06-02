import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { authorizeCronOrAdmin } from "@/lib/api-auth";
import { refreshOperatorSiteRollup } from "@/lib/server/direct-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const ACTIVE_SITE_LABELS: Record<string, string> = {
  omnileads: "Omni Leads",
  ltb: "Love Thy Barber",
  cps: "CPS",
  leifson: "Leifson",
  youngs: "Youngs",
  prime_iv: "Live Better",
  alira: "Alira",
  phoenix: "Phoenix",
  niki: "Niki",
  rene: "Rene Laveau",
  mainst: "Utah Main Street",
  beehive: "Beehive Biz Pulse",
  wasatch: "The Wasatch Post",
  sitanim: "Sitani Mafi",
  imperium: "Imperium",
};

const DEFAULT_BATCH_LIMIT = 2;
const MAX_BATCH_LIMIT = 3;
const PER_SITE_DEADLINE_MS = 18_000;

function boundedLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_LIMIT;
  return Math.min(Math.floor(parsed), MAX_BATCH_LIMIT);
}

function labelFor(slug: string, name?: string | null) {
  return ACTIVE_SITE_LABELS[slug] || name || slug;
}

async function withRefreshDeadline(slug: string, label: string) {
  const refresh = refreshOperatorSiteRollup(slug, label).catch((error) => {
    throw error instanceof Error ? error : new Error("rollup refresh failed");
  });

  return Promise.race([
    refresh,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error("refresh still running; previous cached rollup preserved")),
        PER_SITE_DEADLINE_MS,
      ),
    ),
  ]);
}

async function collectTargets(request: Request) {
  const url = new URL(request.url);
  const singleSlug = url.searchParams.get("slug")?.trim().toLowerCase();
  const limit = boundedLimit(url.searchParams.get("limit"));

  if (singleSlug) {
    if (!ACTIVE_SITE_LABELS[singleSlug]) {
      return {
        error: NextResponse.json(
          { error: `Unknown site slug: ${singleSlug}` },
          { status: 400 },
        ),
      };
    }

    return {
      targets: [{ slug: singleSlug, label: labelFor(singleSlug) }],
      limited: false,
    };
  }

  const targets = Object.entries(ACTIVE_SITE_LABELS)
    .map(([slug, label]) => ({ slug, label: labelFor(slug, label) }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ slug, label }) => ({ slug, label }));

  return { targets, limited: targets.length === limit };
}

async function refresh(request: Request) {
  noStore();
  const denied = await authorizeCronOrAdmin(request);
  if (denied) return denied;

  const collected = await collectTargets(request);
  if ("error" in collected && collected.error) return collected.error;

  const startedAt = Date.now();
  const results: Array<{ slug: string; ok: boolean; ms: number; error?: string }> = [];

  for (const { slug, label } of collected.targets ?? []) {
    const t = Date.now();
    let error: Error | null = null;
    try {
      await withRefreshDeadline(slug, label);
    } catch (err) {
      error = err instanceof Error ? err : new Error("rollup refresh failed");
    }
    results.push({
      slug,
      ok: !error,
      ms: Date.now() - t,
      error: error?.message,
    });
  }

  const response = NextResponse.json({
    ok: results.every((row) => row.ok),
    refreshed: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    limited: collected.limited,
    hint: "Use ?slug=ltb for one site or ?limit=3 for a larger bounded batch.",
    ms: Date.now() - startedAt,
    results,
  });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export async function POST(request: Request) {
  return refresh(request);
}

export async function GET(request: Request) {
  return refresh(request);
}
