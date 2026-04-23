import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
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
