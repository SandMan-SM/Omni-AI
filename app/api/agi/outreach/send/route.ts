import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOutreachEmail } from '@/lib/agi/resend';
import { authorizeCronOrAdmin } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  // Auth-gate. CRITICAL: this endpoint sends a real email through
  // Resend on the tenant's behalf. Without auth: spam vector,
  // domain-reputation damage, real $ on the Resend bill, and an
  // attacker-controlled override_subject/body lets the message body
  // be anything they want signed by the tenant's verified domain.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { asset_id, override_subject, override_body } = await req.json() as {
      asset_id: string;
      override_subject?: string;
      override_body?: string;
    };

    if (!asset_id) {
      return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
    }

    const { data: asset } = await supabase
      .from('omni_outreach_assets')
      .select('*')
      .eq('id', asset_id)
      .single();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.asset_type !== 'email') {
      return NextResponse.json({
        error: `Cannot send asset_type '${asset.asset_type}' via email. Only email assets are sendable.`,
      }, { status: 400 });
    }

    const { data: lead } = await supabase
      .from('omni_leads_generated')
      .select('email, first_name, last_name')
      .eq('id', asset.lead_id)
      .single();

    if (!lead?.email) {
      return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });
    }

    const result = await sendOutreachEmail({
      asset_id,
      to: lead.email,
      subject: override_subject ?? asset.subject,
      body: override_body ?? asset.body,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[outreach/send]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}

// Schedule send for later (asset moves to 'scheduled' status with scheduled_at).
export async function PATCH(req: NextRequest) {
  // Auth-gate. PATCH flips an asset to status='scheduled' which the
  // outbound queue picks up; without auth, anyone could schedule any
  // tenant's drafts to deploy at an attacker-chosen time.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  try {
    const { asset_id, scheduled_at } = await req.json();

    const { data, error } = await supabase
      .from('omni_outreach_assets')
      .update({ status: 'scheduled', scheduled_at })
      .eq('id', asset_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, asset: data });
  } catch (err) {
    console.error('[outreach/send PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
