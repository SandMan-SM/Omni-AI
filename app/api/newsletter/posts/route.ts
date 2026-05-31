import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNewsletterFallbackSummaries } from "@/lib/newsletter-fallback";

// Route config: serve from cache for 60s, edge-revalidate in the background
// for another 10min. This is a public list of published posts that changes
// at most a few times a day, so a 60s cache is invisible to anyone reading
// it but eliminates the per-request 1-9s Supabase hop that was making the
// agentic dashboard appear to load only 2 posts (Supabase planning + I/O
// was eating the prior 8000ms client timeout and falling back to a
// hardcoded 3-post array).
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type NewsletterPostSummary = {
  slug: string | null;
  subject: string | null;
  tier: string | null;
  published_at: string | null;
  created_at?: string | null;
};

async function withAbortTimeout<T>(
  factory: (signal: AbortSignal) => PromiseLike<T>,
  ms: number,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await Promise.resolve(factory(controller.signal));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function archiveDateForIndex(index: number): string {
  const date = new Date(Date.UTC(2026, 4, 31, 14, 0, 0));
  date.setUTCDate(date.getUTCDate() - index);
  return date.toISOString();
}

// GET /api/newsletter/posts — public endpoint for published newsletter posts
// Returns minimal fields (slug, subject, tier, published_at) for dashboard display.
//
// 2026-05-30 fix: use AbortController with a 6.5s budget instead of a
// plain 25s Promise.race. The prior race returned a fallback to JS but left
// the underlying Supabase HTTP request alive, so Vercel could still pin the
// function long enough for public clients to time out. This endpoint is used
// by dashboard/newsletter surfaces; it must answer quickly with real data
// when Supabase is healthy and an explicitly flagged fallback when it is not.
//
// Edge cache: `Cache-Control: s-maxage=60, stale-while-revalidate=600`
// lets Vercel's CDN serve a cached copy for 60s while reasking Supabase
// in the background — so a fresh deploy or a quick second hit is instant.
export async function GET() {
  const sb = createAdminClient();

  const result = await withAbortTimeout(
    (signal) =>
      sb
        .from("newsletter_posts")
        // Keep this public endpoint aligned with the archive/RSS fields only.
        // Some legacy newsletter tables were created before later admin `id`
        // references were standardized; selecting `id` made the endpoint 500
        // even when public posts existed. Slug is the stable public key.
        .select("slug, subject, tier, published_at, created_at")
        .or("published_at.not.is.null,status.eq.published")
        .order("published_at", { ascending: false })
        .limit(100)
        .abortSignal(signal),
    6500
  );

  if (!result) {
    // Supabase didn't respond within 25s. Return fallback BUT flag clearly
    // so the dashboard can render a "loading slow" notice instead of
    // silently displaying stale hardcoded posts as if they were real.
    const res = NextResponse.json({
      posts: getNewsletterFallbackSummaries(),
      source: "fallback",
      reason: "supabase_timeout",
    });
    // Cache the fallback only briefly so a single transient slowness
    // doesn't poison the cache for users who load 10s later.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }

  const { data: posts, error } = result as { data: NewsletterPostSummary[] | null; error: unknown };

  if (error) {
    // Surface the underlying Supabase error message so dashboard debug
    // shows WHY the fallback fired — was it a 503 from PostgREST, a
    // statement timeout from Postgres, a connection pool error, etc.
    const errMsg =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "unknown")
        : String(error ?? "unknown");
    const res = NextResponse.json({
      posts: getNewsletterFallbackSummaries(),
      source: "fallback",
      reason: "supabase_error",
      debug_error: errMsg.slice(0, 300),
    });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }

  const normalizedPosts = (posts || [])
    .filter((p) => p.slug && p.subject)
    .map((p, index) => ({
      ...p,
      published_at: p.published_at || archiveDateForIndex(index),
    }));

  const res = NextResponse.json({
    posts: normalizedPosts.length ? normalizedPosts : getNewsletterFallbackSummaries(),
    source: normalizedPosts.length ? "supabase" : "fallback",
    count: normalizedPosts.length,
  });
  // Real data: 60s edge cache + 10min stale-while-revalidate. Repeats
  // come from CDN, single slow hit doesn't break the next 600s of loads.
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=600",
  );
  return res;
}
