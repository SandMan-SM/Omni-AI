import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/newsletter/posts — public endpoint for published newsletter posts
// Returns minimal fields (id, slug, subject, tier, published_at) for dashboard display
export async function GET() {
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
