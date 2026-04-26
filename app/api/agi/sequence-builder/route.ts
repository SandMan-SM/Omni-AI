import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Visual sequence builder: define multi-channel multi-touch sequences
// stored on the campaign as a structured spec.
// Spec example:
//   { steps: [
//       { channel: 'email', day: 0, subject: 'X', body_template: 'Y' },
//       { channel: 'linkedin', day: 2 },
//       { channel: 'email', day: 5 },
//   ]}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaign_id = searchParams.get('campaign_id');
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 });

  const { data: campaign } = await supabase
    .from('omni_lead_campaigns').select('*').eq('id', campaign_id).single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const icp = campaign.icp as Record<string, unknown>;
  const sequence_spec = icp?.sequence_spec ?? {
    steps: [
      { channel: 'email', day: 0 },
      { channel: 'email', day: 3 },
      { channel: 'email', day: 7 },
    ],
  };

  return NextResponse.json({ campaign_id, sequence_spec });
}

export async function PATCH(req: NextRequest) {
  const { campaign_id, sequence_spec } = await req.json();
  if (!campaign_id || !sequence_spec) {
    return NextResponse.json({ error: 'campaign_id and sequence_spec required' }, { status: 400 });
  }

  const { data: campaign } = await supabase
    .from('omni_lead_campaigns').select('icp').eq('id', campaign_id).single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const newIcp = { ...(campaign.icp as Record<string, unknown>), sequence_spec };
  const { error } = await supabase
    .from('omni_lead_campaigns').update({ icp: newIcp }).eq('id', campaign_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sequence_spec });
}
