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

export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Personas include sender_email + signature_html — leaking
  // them across tenants exposes who's sending mail on each tenant's behalf.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_sender_personas').select('*').eq('business_id', business_id).order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ personas: data });
}

export async function POST(req: NextRequest) {
  // Auth-gate. POST creates a sender persona that the round-robin
  // picker will use to relay outbound mail. Without auth, anyone could
  // mint a persona on a tenant — pointing at attacker email/signature.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, name, email, title, bio, signature_html, daily_send_limit } = await req.json();
  if (!business_id || !name || !email) {
    return NextResponse.json({ error: 'business_id, name, email required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_sender_personas')
    .insert({ business_id, name, email, title, bio, signature_html, daily_send_limit: daily_send_limit ?? 50 })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persona: data });
}

// Allowlist on PATCH — without this a caller could PATCH `{ id, sends_today: 0 }`
// to bypass the daily send limit, or `business_id` to transfer ownership.
const PATCHABLE_PERSONA_FIELDS = new Set([
  'name', 'sender_email', 'sender_signature', 'tone', 'is_active',
  'daily_send_limit',
]);

export async function PATCH(req: NextRequest) {
  // Auth-gate. Allowlist below blocks mass-assignment but PATCH still
  // needs auth so an attacker can't flip is_active or raise daily_send_limit
  // on another tenant's persona.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    if (PATCHABLE_PERSONA_FIELDS.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_sender_personas').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persona: data });
}

export async function DELETE(req: NextRequest) {
  // Auth-gate. DELETE drops a persona by id — without auth, anyone can
  // wipe a tenant's sending identities and break their outbound flow.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_sender_personas').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

// Round-robin: PUT returns next available persona for a business
export async function PUT(req: NextRequest) {
  // Auth-gate. PUT both reads + increments sends_today; an unauthed
  // attacker could exhaust a tenant's daily_send_limit by repeatedly
  // calling this and starve the real outbound queue.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id } = await req.json();
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data: personas } = await supabase
    .from('omni_sender_personas').select('*')
    .eq('business_id', business_id).eq('is_active', true)
    .order('last_send_at', { ascending: true, nullsFirst: true });

  // Pick first persona under daily limit
  const today = new Date().toISOString().slice(0, 10);
  const available = (personas ?? []).find(p => {
    const lastSendDate = p.last_send_at ? p.last_send_at.slice(0, 10) : null;
    const sendsToday = lastSendDate === today ? (p.sends_today ?? 0) : 0;
    return sendsToday < p.daily_send_limit;
  });

  if (!available) {
    return NextResponse.json({ error: 'No available persona under daily limit' }, { status: 503 });
  }

  // Increment usage
  const lastSendDate = available.last_send_at?.slice(0, 10);
  const newCount = lastSendDate === today ? (available.sends_today ?? 0) + 1 : 1;
  await supabase
    .from('omni_sender_personas')
    .update({ sends_today: newCount, last_send_at: new Date().toISOString() })
    .eq('id', available.id);

  return NextResponse.json({ ok: true, persona: available });
}
