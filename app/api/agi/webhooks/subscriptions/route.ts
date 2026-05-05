import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { authorizeCronOrAdmin } from '@/lib/api-auth';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// User webhook subscription management
export async function GET(req: NextRequest) {
  noStore();
  // Auth-gate. Webhook rows include endpoint_url + plaintext secret
  // (used to HMAC-sign delivery). Leaking those = full webhook
  // signature spoof against the receiver.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const business_id = searchParams.get('business_id');
  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('omni_user_webhooks').select('*').eq('business_id', business_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data });
}

export async function POST(req: NextRequest) {
  // Auth-gate. POST registers a webhook subscription where the
  // tenant ships every lead/reply/booking event. Without auth, an
  // attacker can register their own endpoint on any tenant and
  // siphon every inbound event into their own server.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { business_id, endpoint_url, events } = await req.json();
  if (!business_id || !endpoint_url) {
    return NextResponse.json({ error: 'business_id and endpoint_url required' }, { status: 400 });
  }

  // SSRF guard at write time. lib/agi/webhooks fires `fetch(wh.endpoint_url)`
  // on every event, so a malicious caller registering
  // `http://169.254.169.254/...` would have the server hit AWS metadata
  // every time a lead/reply/booking landed. Reject the obvious shapes here
  // so they never get persisted.
  let parsed: URL;
  try { parsed = new URL(endpoint_url); } catch {
    return NextResponse.json({ error: 'Invalid endpoint_url' }, { status: 400 });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'endpoint_url must be http(s)' }, { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' || host === '0.0.0.0' || host === '::1' ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^169\.254\./.test(host) ||
    /^\[?::1\]?$/.test(host) || /^\[?f[cd][0-9a-f]{2}:/i.test(host) || /^\[?fe80:/i.test(host);
  if (isPrivate) {
    return NextResponse.json({ error: 'endpoint_url cannot point to a private/loopback/metadata host' }, { status: 400 });
  }

  const secret = randomBytes(24).toString('hex');
  const { data, error } = await supabase
    .from('omni_user_webhooks')
    .insert({
      business_id, endpoint_url,
      events: events ?? ['lead.created', 'reply.received', 'booking.created'],
      secret,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return secret (only time it's visible in plaintext)
  return NextResponse.json({
    ok: true,
    webhook: data,
    note: 'Use the secret to verify X-OmniLeads-Signature header (HMAC-SHA256 of body). Save now.',
  });
}

export async function DELETE(req: NextRequest) {
  // Auth-gate. DELETE drops a webhook by id — without auth, anyone
  // can wipe a tenant's outbound integrations.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabase.from('omni_user_webhooks').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
