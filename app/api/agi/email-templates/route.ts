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

// Email templates: saved subject/body with variable substitution.
// Variables format: {{first_name}}, {{company}}, etc.
export async function GET(req: NextRequest) {
  noStore();
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  let query = supabase.from('omni_email_templates').select('*').order('use_count', { ascending: false });
  if (business_id) query = query.eq('business_id', business_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

export async function POST(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, name, category, subject, body, variables } = await req.json();
  if (!business_id || !name || !body) {
    return NextResponse.json({ error: 'business_id, name, body required' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_email_templates')
    .insert({ business_id, name, category, subject, body, variables: variables ?? [] })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

// Allowlist on PATCH so the spread can't transfer ownership (business_id)
// or reset use_count from the API.
const PATCHABLE_TEMPLATE_FIELDS = new Set([
  'name', 'category', 'subject', 'body', 'variables',
]);

export async function PATCH(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    if (PATCHABLE_TEMPLATE_FIELDS.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('omni_email_templates').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

export async function DELETE(req: NextRequest) {
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_email_templates').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

// Render endpoint: substitute variables in a template
export async function PUT(req: NextRequest) {
  const { template_id, lead_id } = await req.json();
  const { data: template } = await supabase
    .from('omni_email_templates').select('*').eq('id', template_id).single();
  const { data: lead } = await supabase
    .from('omni_leads_generated').select('*').eq('id', lead_id).single();
  if (!template || !lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Cross-tenant guard: a template from Tenant A combined with a lead from
  // Tenant B would render Tenant B's PII into Tenant A's template body and
  // return it to the caller. Refuse the combination.
  if (template.business_id !== lead.business_id) {
    return NextResponse.json({ error: 'Template and lead are not in the same business' }, { status: 403 });
  }

  const { data: business } = await supabase
    .from('omni_businesses').select('*').eq('id', lead.business_id).single();

  const ctx: Record<string, string> = {
    first_name: lead.first_name ?? 'there',
    last_name: lead.last_name ?? '',
    full_name: [lead.first_name, lead.last_name].filter(Boolean).join(' '),
    title: lead.title ?? '',
    company: lead.company ?? '',
    location: lead.lead_location ?? '',
    sender_name: (business as { sender_name?: string })?.sender_name ?? '',
    sender_email: (business as { sender_email?: string })?.sender_email ?? '',
    business_name: business?.name ?? '',
    booking_url: (business as { booking_url?: string })?.booking_url ?? '',
    pain_point: 'this challenge',
  };

  const sub = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? `{{${k}}}`);

  // Bump use count
  await supabase
    .from('omni_email_templates')
    .update({ use_count: (template.use_count ?? 0) + 1 })
    .eq('id', template_id);

  return NextResponse.json({
    ok: true,
    rendered: {
      subject: sub(template.subject ?? ''),
      body: sub(template.body),
    },
  });
}
