import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PATCH /api/admin/newsletter-toggle
// Toggle newsletter_subscribed on a profile
export async function PATCH(req: Request) {
  try {
    const { profileId, subscribed } = await req.json();
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("profiles")
      .update({ newsletter_subscribed: subscribed })
      .eq("id", profileId)
      .select("id, newsletter_subscribed")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
