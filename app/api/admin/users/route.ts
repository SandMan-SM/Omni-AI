import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, email, name, role, tier, phone, business_name, crm_status, lead_score } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Check if username already exists in credentials
    const { data: existing } = await supabase
      .from("user_credentials")
      .select("username")
      .eq("username", username)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    // Create profile
    const profileData = {
      id: crypto.randomUUID(),
      username: username,
      email: email || `${username}@omni.local`,
      name: name || null,
      phone: phone || null,
      business_name: business_name || null,
      role: role || "user",
      is_admin: role === "admin",
      is_sponsor: role === "sponsor",
      tier: tier ?? 0,
      crm_status: crm_status || "lead",
      lead_score: lead_score || "cold",
      onboarding_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Create credentials
    const { error: credError } = await supabase
      .from("user_credentials")
      .insert({ username, password_hash: password, profile_id: profile.id });

    if (credError) {
      // Rollback profile
      await supabase.from("profiles").delete().eq("id", profile.id);
      return NextResponse.json({ error: credError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
