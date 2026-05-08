import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isValidEmail,
  isBotSubmission,
  sanitizeText,
} from '@/lib/validation';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import {
  INBOUND_ORIGINS,
  isInboundSlug,
  pickAllowedOrigin,
  type InboundSlug,
} from '@/lib/inbound-types';
import {
  notifyOwnerEmailInbound,
  notifyOwnerTelegramInbound,
} from '@/lib/inbound-notify';

/**
 * Generic inbound lead intake. Drop-in replacement for /api/cps/leads,
 * parameterised by slug. Each client website's contact / consultation
 * form posts here.
 *
 * Writes to inbound_<slug>_leads, then fans out notification to email
 * (Resend) and Telegram via lib/inbound-notify.
 *
 * Rate-limited 5/10-min/IP/slug.
 */

function corsHeaders(slug: InboundSlug, origin: string | null): HeadersInit {
  const allowed = INBOUND_ORIGINS[slug];
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : pickAllowedOrigin(slug, origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isInboundSlug(slug)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(slug, request.headers.get('origin')),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isInboundSlug(slug)) {
    return NextResponse.json({ error: 'Unknown brand' }, { status: 404 });
  }

  const origin = request.headers.get('origin');
  const cors = corsHeaders(slug, origin);

  try {
    const ip = getClientIp(request.headers);
    const rl = rateLimit(`inbound-leads:${slug}:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.ok) {
      const r = rateLimitResponse(rl.resetMs);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
      return r;
    }

    const body = await request.json().catch(() => ({}));

    if (isBotSubmission(body)) {
      // Silent success so spammers don't tune their probes.
      return NextResponse.json({ ok: true }, { headers: cors });
    }

    const name = sanitizeText(body.name, 200);
    const email = sanitizeText(body.email, 254).toLowerCase();
    const phone = sanitizeText(body.phone, 50);
    const message = sanitizeText(body.message, 4000);
    const source = sanitizeText(body.source, 50) || 'contact_form';

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required.' },
        { status: 400, headers: cors },
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400, headers: cors },
      );
    }
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone is required.' },
        { status: 400, headers: cors },
      );
    }

    const fallbackHost = INBOUND_ORIGINS[slug][0] ?? 'https://omnileadsagi.com';
    const pageUrl = sanitizeText(body.page_url, 2048);
    let pagePath: string | null = null;
    try {
      if (pageUrl) pagePath = new URL(pageUrl, fallbackHost).pathname;
    } catch {
      pagePath = null;
    }

    const sb = createAdminClient();
    const tableName = `inbound_${slug}_leads`;

    // Resolve business_id from slug. The inbound_<slug>_leads tables
    // declare business_id as NOT NULL with no default — every insert
    // has to pass it. Previously this lookup only happened during the
    // omni_leads_generated mirror further below, which meant the
    // primary insert quietly relied on a default that doesn't exist.
    // (Pre-Rene tenants had rows from manual seeding; new slugs would
    // 500 on first form submit until this was fixed.)
    const { data: bizRow } = await sb
      .from('omni_businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    const businessId = bizRow?.id ?? null;
    if (!businessId) {
      console.error(`[inbound/${slug}/leads] no omni_businesses row for slug`);
      return NextResponse.json(
        { error: 'Tenant not configured.' },
        { status: 500, headers: cors },
      );
    }

    const { data: inserted, error: insertError } = await sb
      .from(tableName)
      .insert({
        business_id: businessId,
        // Existing schema uses full_name (not `name`) and raw_data (not properties).
        full_name: name,
        email: email || null,
        phone: phone || null,
        message: message || null,
        service_interest: sanitizeText(body.service_interest, 200) || null,
        company: sanitizeText(body.company, 200) || null,
        source,
        status: 'new',
        page_url: pageUrl || null,
        page_path: pagePath,
        visitor_id: sanitizeText(body.visitor_id, 100) || null,
        session_id: sanitizeText(body.session_id, 100) || null,
        utm_source: sanitizeText(body.utm_source, 100) || null,
        utm_medium: sanitizeText(body.utm_medium, 100) || null,
        utm_campaign: sanitizeText(body.utm_campaign, 100) || null,
        referrer: sanitizeText(body.referrer, 2048) || null,
        ip_address: ip,
        user_agent: sanitizeText(body.user_agent, 500) || null,
        raw_data: body && typeof body === 'object' ? body : {},
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error(`[inbound/${slug}/leads] insert error:`, insertError);
      return NextResponse.json(
        { error: "We couldn't save your submission. Please try again." },
        { status: 500, headers: cors },
      );
    }

    const lead = {
      id: inserted.id as string,
      slug,
      name,
      email: email || null,
      phone: phone || null,
      message: message || null,
      source,
      pageUrl: pageUrl || null,
    };

    const [emailOk, telegramOk] = await Promise.all([
      notifyOwnerEmailInbound(lead).catch((e) => {
        console.error(`[inbound/${slug}/leads] email notify failed`, e);
        return false;
      }),
      notifyOwnerTelegramInbound(lead).catch((e) => {
        console.error(`[inbound/${slug}/leads] telegram notify failed`, e);
        return false;
      }),
    ]);

    if (emailOk || telegramOk) {
      await sb
        .from(tableName)
        .update({ email_notified: emailOk, telegram_notified: telegramOk })
        .eq('id', lead.id);
    }

    // Mirror into the agentic CRM so the same lead surfaces in the workspace
    // dashboard's Contacts tab (omni_leads_generated). Without this, every
    // inbound form submission would only land in inbound_<slug>_leads and
    // be invisible to the operator's main workflow until manually synced.
    // Idempotent via (source_table, source_record_id) — re-running the
    // endpoint won't double-insert.
    try {
      // businessId already resolved above; no need to re-query.
      if (businessId) {
        const firstName = (name.split(' ')[0] || 'Unknown').slice(0, 80);
        const lastName  = name.split(' ').slice(1).join(' ').trim() || null;
        await sb.from('omni_leads_generated').insert({
          business_id: businessId,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          source: 'web', // CHECK constraint allows: apollo, web, linkedin, referral, manual
          status: 'new',
          notes: message || null,
          raw_data: { ...body, inbound_source: source },
          source_table: tableName,
          source_record_id: lead.id,
          pipeline_type: 'inbound',
        });
      }
    } catch (e) {
      // Non-fatal — the inbound row already landed and the operator was
      // notified. CRM sync failure surfaces in logs but doesn't fail the form.
      console.error(`[inbound/${slug}/leads] CRM mirror failed:`, e);
    }

    // Stage N.2 — federation cross-brand attribution.
    // If the visitor was driven here by a federation cross-promo (their
    // tracker captured `referring_federation_slug` from a `?ref=`
    // querystring on first arrival), record the conversion. The lead
    // itself was already saved above; this adds an attribution-only row.
    try {
      const referringSlug = sanitizeText(body.referring_federation_slug, 64);
      const referringCreative = sanitizeText(body.referring_creative_id, 64);
      if (referringSlug && referringSlug !== slug) {
        await sb.from('cross_brand_referrals').insert({
          originating_slug: referringSlug,
          target_slug: slug,
          creative_id: referringCreative || null,
          visitor_id: sanitizeText(body.visitor_id, 100) || null,
          session_id: sanitizeText(body.session_id, 100) || null,
          lead_id: lead.id,
          page_path: pagePath,
          attribution_breakdown: {
            first_touch: 0.3,
            last_touch: 0.5,
            linear: 0.2,
            note: 'Stage N.2 advisory split; not yet enforced in payouts.',
          },
        });
        // Also drop a conversion row for the dashboard funnel rollups.
        if (referringCreative) {
          await sb.from('cross_ad_conversions').insert({
            creative_id: referringCreative,
            originating_slug: referringSlug,
            target_slug: slug,
            target_event_type: 'lead_form_submit',
            value_usd: null,
          });
        }
      }
    } catch (e) {
      console.warn(`[inbound/${slug}/leads] referral attribution failed:`, e);
    }

    return NextResponse.json({ ok: true, id: lead.id }, { headers: cors });
  } catch (e) {
    console.error(`[inbound/${slug}/leads] failed:`, e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors });
  }
}
