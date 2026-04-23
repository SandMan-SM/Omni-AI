import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Deployment-history telemetry. Previously unauthenticated — anonymous
 * callers could (a) read the full deployment history (includes project
 * names, commit SHAs, deploy URLs — useful recon for attackers mapping
 * the agency's client roster) and (b) insert fabricated deployment rows
 * to confuse the admin SystemMonitor dashboard.
 *
 * Now admin-gated via authorizeCronOrAdmin. Same auth pattern as
 * commands + visual-errors siblings.
 */

export async function GET(req: Request) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("website_deployments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

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
      .from("website_deployments")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('[agents/deployments] POST error:', err);
    return NextResponse.json(
      { error: "We couldn't record that deployment. Please try again." },
      { status: 500 },
    );
  }
}
