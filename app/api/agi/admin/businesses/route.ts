import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Super-admin: see all businesses + key metrics across the system.
//
// Previous bespoke gate did `if (!process.env.ADMIN_API_KEY) return true`,
// meaning any Vercel deploy without ADMIN_API_KEY explicitly set served
// per-tenant lead/reply/booking aggregates to anyone. Switch to the
// shared cron-or-admin gate so this route follows the same auth model
// as the rest of /api/agi/* — accepts cookie session, omni_token bearer,
// or CRON_SECRET. Fail-closed by construction.
export async function GET(req: NextRequest) {
  noStore();
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;

  // Sort by display_order so Omni AI (display_order=1) comes first.
  const { data: businesses } = await supabase
    .from('omni_businesses').select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  // Aggregate metrics per business
  const enriched = await Promise.all((businesses ?? []).map(async (b) => {
    const [{ count: leads }, { count: replies }, { count: bookings }] = await Promise.all([
      supabase.from('omni_leads_generated').select('*', { count: 'exact', head: true }).eq('business_id', b.id),
      supabase.from('omni_outreach_assets').select('*', { count: 'exact', head: true }).eq('business_id', b.id).eq('status', 'replied'),
      supabase.from('omni_meeting_bookings').select('*', { count: 'exact', head: true }).eq('business_id', b.id),
    ]);
    return {
      ...b,
      stats: {
        leads: leads ?? 0,
        replies: replies ?? 0,
        bookings: bookings ?? 0,
      },
    };
  }));

  // System-wide totals
  const totalLeads = enriched.reduce((s, b) => s + b.stats.leads, 0);
  const totalReplies = enriched.reduce((s, b) => s + b.stats.replies, 0);
  const totalBookings = enriched.reduce((s, b) => s + b.stats.bookings, 0);

  return NextResponse.json({
    businesses: enriched,
    system_totals: {
      businesses_count: enriched.length,
      leads: totalLeads,
      replies: totalReplies,
      bookings: totalBookings,
      active_subscriptions: enriched.filter(b => b.subscription_status === 'active').length,
    },
  });
}
