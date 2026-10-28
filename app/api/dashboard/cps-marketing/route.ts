import { NextResponse } from "next/server";
import { resolveCallerProfileId } from "@/lib/server/dashboard-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPlatformDashboardAccess } from "@/lib/mafi-access";
import { cpsMarketingContent } from "@/lib/server/cps-marketing-content";

export const dynamic = "force-dynamic";

export async function GET() {
  const responseHeaders = { "Cache-Control": "private, no-store" };
  const callerId = await resolveCallerProfileId();
  if (!callerId) return NextResponse.json({ error: "Sign in to view this report." }, { status: 401, headers: responseHeaders });
  const { data: profile, error } = await createAdminClient().from("profiles")
    .select("id, username, email, name, role, is_admin").eq("id", callerId).maybeSingle();
  if (error) return NextResponse.json({ error: "Report temporarily unavailable." }, { status: 503, headers: responseHeaders });
  if (!profile || (!hasPlatformDashboardAccess(profile) && profile.username?.toLowerCase() !== "cps")) {
    return NextResponse.json({ error: "CPS operator access is required." }, { status: 403, headers: responseHeaders });
  }
  return NextResponse.json(cpsMarketingContent, { headers: responseHeaders });
}
