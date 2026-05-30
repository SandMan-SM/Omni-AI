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
};

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// GET /api/newsletter/posts — public endpoint for published newsletter posts
// Returns minimal fields (slug, subject, tier, published_at) for dashboard display.
//
// 2026-05-29 fix: raised client timeout 8000 → 25000ms because cold/loaded
// Supabase was hitting 8.5s execution time on a fully indexed query (the
// idx_newsletter_posts_published index exists; the wall-clock time was just
// Supabase Pro tier capacity). The old 8s cap masked the real data behind
// a 3-row hardcoded fallback — operator reported "only 2 of my 60 posts."
// Real fix is at the DB tier (raise compute, or migrate to a faster cache),
// but raising this timeout while we sort that surfaces real data when the
// DB is just slow rather than truly down.
//
// Edge cache: `Cache-Control: s-maxage=60, stale-while-revalidate=600`
// lets Vercel's CDN serve a cached copy for 60s while reasking Supabase
// in the background — so a fresh deploy or a quick second hit is instant.
export async function GET() {
  const sb = createAdminClient();

  const result = await withTimeout(
    sb
      .from("newsletter_posts")
      // Keep this public endpoint aligned with the archive/RSS fields only.
      // Some legacy newsletter tables were created before later admin `id`
      // references were standardized; selecting `id` made the endpoint 500
      // even when public posts existed. Slug is the stable public key.
      .select("slug, subject, tier, published_at")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(100),
    25000
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

  const res = NextResponse.json({
    posts: posts?.length ? posts : getNewsletterFallbackSummaries(),
    source: posts?.length ? "supabase" : "fallback",
    count: posts?.length ?? 0,
  });
  // Real data: 60s edge cache + 10min stale-while-revalidate. Repeats
  // come from CDN, single slow hit doesn't break the next 600s of loads.
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=600",
  );
  return res;
}
