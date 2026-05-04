import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// GET /api/newsletter/posts — public endpoint for published newsletter posts
// Returns minimal fields (id, slug, subject, tier, published_at) for dashboard display.
//
// `noStore()` is critical: without it, Next.js's automatic fetch cache wraps
// the Supabase REST call and serves stale data even after a DB UPDATE. We
// hit this hard during the Apr→May newsletter cleanup — DB had 13 published
// partner posts but the API kept returning all 201. The trio of route
// configs (dynamic / revalidate / fetchCache) plus noStore() is what
// guarantees every request hits Postgres live.
export async function GET() {
  noStore();
  const sb = createAdminClient();

  const { data: posts, error } = await sb
    .from("newsletter_posts")
    .select("id, slug, subject, tier, published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }

  const res = NextResponse.json({ posts: posts || [] });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
