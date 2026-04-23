import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Visual-error telemetry surface. Previously unauthenticated — anonymous
 * callers could (a) read screenshot URLs + error metadata for every
 * recorded incident and (b) spam the visual_errors table with arbitrary
 * inserts (poisoning the admin Visual-Errors panel + filling storage).
 *
 * Now admin-gated via authorizeCronOrAdmin. Cookie session from the
 * admin SystemMonitor works by default; CRON_SECRET bearer supports
 * external agent writebacks.
 */

export async function GET(req: Request) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("visual_errors")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { data, error } = await supabase
      .from("visual_errors")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('[agents/visual-errors] POST error:', err);
    return NextResponse.json(
      { error: "We couldn't record that visual error. Please try again." },
      { status: 500 },
    );
  }
}
