import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getNewsletterAudience,
  computeAudienceStats,
} from "@/lib/newsletter-audience";

export const dynamic = "force-dynamic";

// GET /api/admin/newsletter/audience
//
// Returns the canonical newsletter audience — the EXACT set the send job
// will hit — plus stats computed from the same array. This is the single
// source of truth the Newsletter Studio panel consumes. Everything (list,
// counts, stat cards, CSV export) derives from the same shape so the UI
// can never show one number in the stat card and a different count in the
// list underneath.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const admin = createAdminClient();
  const members = await getNewsletterAudience(admin);
  const stats = computeAudienceStats(members);

  const res = NextResponse.json({ members, stats });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
