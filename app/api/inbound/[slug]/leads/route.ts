import { timingSafeEqual } from 'node:crypto';
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
  notifyOwnerEmailInboundWithReceipt,
  notifyOwnerTelegramInbound,
} from '@/lib/inbound-notify';
import {
  isActiveTenant,
  tenantOrigins,
  recordLeadAndReturn,
  recordLeadNotificationState,
} from '@/lib/server/analytics-ingest';

/**
 * Generic inbound lead intake. Drop-in replacement for /api/cps/leads,
 * parameterised by slug. Each client website's contact / consultation
 * form posts here.
 *
 * Writes to inbound_<slug>_leads, then fans out notification to email
 * (Resend) and Telegram via lib/inbound-notify.
 *
 * Browser-facing legacy callers are rate-limited 5/10-min/IP/slug.
 * Lead Franchise is service-authenticated and rate-limited at its public
 * frontend so unrelated visitors are not grouped under one Vercel egress IP.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGISTRY_RECEIPTS_KEY = 'leadfranchise_owner_receipts';

type RegistryContact = {
  id: string;
  rawData: Record<string, unknown>;
  ownerMessageId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function registryOwnerMessageId(
  rawData: Record<string, unknown>,
  leadId: string,
): string | null {
  const receipts = asRecord(rawData[REGISTRY_RECEIPTS_KEY]);
  const receipt = asRecord(receipts[leadId]);
  return typeof receipt.provider_id === 'string' && receipt.provider_id
    ? receipt.provider_id
    : null;
}

function safeSecretEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function leadFranchiseAuthorized(request: Request, slug: string): boolean {
  if (slug !== 'leadfranchise') return true;
  const expected = process.env.LEADFRANCHISE_INBOUND_SECRET || '';
  const supplied = request.headers.get('x-leadfranchise-token') || '';
  return (
    expected.length >= 32 &&
    supplied.length >= 32 &&
    safeSecretEqual(expected, supplied)
  );
}

async function syncRegistryContact(input: {
  slug: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  intakeId: string;
  analyticsLeadId: string;
  body: Record<string, unknown>;
}): Promise<RegistryContact | null> {
  const sb = createAdminClient();
  const { data: business, error: businessError } = await sb
    .from('omni_businesses')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle();
  if (businessError || !business?.id) return null;

  const firstName = (input.name.split(/\s+/)[0] || 'Unknown').slice(0, 80);
  const lastName =
    input.name.split(/\s+/).slice(1).join(' ').trim().slice(0, 120) ||
    null;
  const sourceTable = 'leadfranchise_intakes';
  const sourceRecordId = UUID_RE.test(input.intakeId)
    ? input.intakeId
    : null;
  const incomingRawData: Record<string, unknown> = {
    ...input.body,
    inbound_source: input.source,
  };
  // Receipt state is receiver-owned. Never accept a value for it from the
  // caller's JSON body, even though this endpoint is service-authenticated.
  delete incomingRawData[REGISTRY_RECEIPTS_KEY];

  type ContactRow = {
    id: string;
    email: string | null;
    raw_data: unknown;
  };
  let contact: ContactRow | null = null;

  if (sourceRecordId) {
    const { data, error } = await sb
      .from('omni_leads_generated')
      .select('id,email,raw_data')
      .eq('business_id', business.id)
      .eq('source_table', sourceTable)
      .eq('source_record_id', sourceRecordId)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    contact = (data as ContactRow | null) ?? null;
  }

  if (!contact && input.email) {
    // Escape ILIKE metacharacters, then compare normalized values in memory.
    // This keeps existing mixed-case CRM contacts linkable without letting an
    // underscore in an email address act as a single-character wildcard.
    const emailPattern = input.email.replace(/[\\%_]/g, '\\$&');
    const { data, error } = await sb
      .from('omni_leads_generated')
      .select('id,email,raw_data')
      .eq('business_id', business.id)
      .ilike('email', emailPattern)
      .limit(10);
    if (error) return null;
    contact =
      ((data as ContactRow[] | null) ?? []).find(
        (candidate) =>
          candidate.email?.trim().toLowerCase() === input.email,
      ) ?? null;
  }

  const existingRawData = asRecord(contact?.raw_data);
  const rawData = {
    ...existingRawData,
    ...incomingRawData,
    // Preserve receipt history even if a future caller sends a colliding key.
    [REGISTRY_RECEIPTS_KEY]: asRecord(
      existingRawData[REGISTRY_RECEIPTS_KEY],
    ),
  };
  const update = {
    first_name: firstName,
    ...(lastName ? { last_name: lastName } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    notes: input.message || null,
    raw_data: rawData,
    ...(sourceRecordId
      ? {
          source_table: sourceTable,
          source_record_id: sourceRecordId,
        }
      : {}),
    updated_at: new Date().toISOString(),
  };

  if (contact) {
    const { data, error } = await sb
      .from('omni_leads_generated')
      .update(update)
      .eq('id', contact.id)
      .select('id')
      .maybeSingle();
    if (error || !data?.id) return null;
    return {
      id: data.id,
      rawData,
      ownerMessageId: registryOwnerMessageId(
        rawData,
        input.analyticsLeadId,
      ),
    };
  }

  const { data: inserted, error: insertError } = await sb
    .from('omni_leads_generated')
    .insert({
      business_id: business.id,
      source: 'web',
      status: 'new',
      ...update,
      pipeline_type: 'inbound',
    })
    .select('id')
    .single();
  if (!insertError && inserted?.id) {
    return {
      id: inserted.id,
      rawData,
      ownerMessageId: null,
    };
  }

  // A concurrent request may win the unique email constraint. Re-read and
  // update the winner so a valid repeat signup never becomes a visible error.
  if (input.email) {
    const emailPattern = input.email.replace(/[\\%_]/g, '\\$&');
    const { data: candidates, error: winnerError } = await sb
      .from('omni_leads_generated')
      .select('id,email,raw_data')
      .eq('business_id', business.id)
      .ilike('email', emailPattern)
      .limit(10);
    if (winnerError) return null;
    const winner =
      ((candidates as ContactRow[] | null) ?? []).find(
        (candidate) =>
          candidate.email?.trim().toLowerCase() === input.email,
      ) ?? null;
    if (winner) {
      const winnerRawData = {
        ...asRecord(winner.raw_data),
        ...incomingRawData,
        [REGISTRY_RECEIPTS_KEY]: asRecord(
          asRecord(winner.raw_data)[REGISTRY_RECEIPTS_KEY],
        ),
      };
      const { data, error } = await sb
        .from('omni_leads_generated')
        .update({ ...update, raw_data: winnerRawData })
        .eq('id', winner.id)
        .select('id')
        .maybeSingle();
      if (error || !data?.id) return null;
      return {
        id: data.id,
        rawData: winnerRawData,
        ownerMessageId: registryOwnerMessageId(
          winnerRawData,
          input.analyticsLeadId,
        ),
      };
    }
  }

  return null;
}

async function persistRegistryOwnerReceipt(
  contact: RegistryContact,
  analyticsLeadId: string,
  providerId: string,
): Promise<boolean> {
  const sb = createAdminClient();
  const { data: current, error: readError } = await sb
    .from('omni_leads_generated')
    .select('raw_data')
    .eq('id', contact.id)
    .maybeSingle();
  if (readError || !current) return false;

  const currentRawData = asRecord(current.raw_data);
  const receipts = {
    ...asRecord(currentRawData[REGISTRY_RECEIPTS_KEY]),
    [analyticsLeadId]: {
      provider: 'resend',
      provider_id: providerId,
      accepted_at: new Date().toISOString(),
    },
  };
  const { data, error } = await sb
    .from('omni_leads_generated')
    .update({
      raw_data: {
        ...currentRawData,
        [REGISTRY_RECEIPTS_KEY]: receipts,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', contact.id)
    .select('id')
    .maybeSingle();
  return !error && Boolean(data?.id);
}

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

/** CORS for registry-driven (non-legacy) tenants — origins from analytics.tenants. */
function registryCors(origins: string[], origin: string | null): HeadersInit {
  const ok = origin && origins.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : origins[0] ?? '*',
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
  if (!isInboundSlug(slug)) {
    if (!(await isActiveTenant(slug))) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 204, headers: registryCors(await tenantOrigins(slug), request.headers.get('origin')) });
  }
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
  if (!isInboundSlug(slug) && !(await isActiveTenant(slug))) {
    return NextResponse.json({ error: 'Unknown brand' }, { status: 404 });
  }

  const origin = request.headers.get('origin');
  const cors: HeadersInit = isInboundSlug(slug)
    ? corsHeaders(slug, origin)
    : registryCors(await tenantOrigins(slug), origin);

  try {
    if (!leadFranchiseAuthorized(request, slug)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized caller.' },
        { status: 401, headers: cors },
      );
    }

    const ip = getClientIp(request.headers);
    if (slug !== 'leadfranchise') {
      const rl = rateLimit(`inbound-leads:${slug}:${ip}`, 5, 10 * 60 * 1000);
      if (!rl.ok) {
        const r = rateLimitResponse(rl.resetMs);
        Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
        return r;
      }
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
    const intakeId = sanitizeText(body.intake_id, 64);

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

    // Write to the shared analytics schema FIRST — the dashboard-visible sink
    // that captures the lead even if the legacy per-tenant table / omni_businesses
    // row is missing (the old "Tenant not configured" 500 used to drop leads).
    const dedupKey = `${(email || phone || '').toLowerCase()}:${(source || '').slice(0, 20)}`;
    const sharedLead = await recordLeadAndReturn({
      slug,
      name,
      email: email || undefined,
      phone: phone || undefined,
      message: message || undefined,
      source,
      page_url: sanitizeText(body.page_url, 2048) || undefined,
      dedup_key: dedupKey || undefined,
      props: body && typeof body === 'object' ? body : {},
    });
    if (!sharedLead) {
      return NextResponse.json(
        {
          ok: false,
          error: "We couldn't save your submission. Please try again.",
          code: 'lead_storage_unavailable',
        },
        { status: 503, headers: cors },
      );
    }

    // Registry (non-legacy) tenants have no per-tenant table — the shared write
    // above is their system of record.
    //
    // They still get the owner notification. The email channel is required:
    // return success only after Resend accepts it and that acceptance is
    // persisted. Repeated submissions reuse the same analytics row and stable
    // provider idempotency key, so they update/link rather than fail or resend.
    if (!isInboundSlug(slug)) {
      const publicLeadId = Number(sharedLead.id);
      if (!Number.isSafeInteger(publicLeadId) || publicLeadId <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "We couldn't confirm the saved lead identifier.",
            code: 'lead_identifier_invalid',
          },
          { status: 503, headers: cors },
        );
      }
      let crmContactId: string | null = null;
      let registryContact: RegistryContact | null = null;
      if (slug === 'leadfranchise') {
        registryContact = await syncRegistryContact({
          slug,
          name,
          email,
          phone,
          message,
          source,
          intakeId,
          analyticsLeadId: sharedLead.id,
          body: body && typeof body === 'object' ? body : {},
        });
        crmContactId = registryContact?.id ?? null;
        if (!registryContact) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "We saved your request but couldn't sync it to the workspace. Please try again.",
              code: 'agentic_dashboard_sync_failed',
            },
            { status: 503, headers: cors },
          );
        }
      }

      if (sharedLead.notified) {
        const persistedOwnerMessageId =
          sharedLead.ownerMessageId ?? registryContact?.ownerMessageId ?? null;
        if (slug === 'leadfranchise' && !persistedOwnerMessageId) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "We couldn't verify the prior owner notification. Please try again.",
              code: 'owner_receipt_unavailable',
            },
            { status: 503, headers: cors },
          );
        }
        return NextResponse.json(
          {
            ok: true,
            deduplicated: true,
            lead_id: publicLeadId,
            crm_contact_id: crmContactId,
            owner_message_id: persistedOwnerMessageId ?? undefined,
          },
          { headers: cors },
        );
      }

      // A previous request can be interrupted after Resend accepts the owner
      // email and its receipt reaches the CRM mirror, but before the analytics
      // notification state commits. Recover from that exact partial state
      // without sending the owner email a second time.
      if (registryContact?.ownerMessageId) {
        const recovered = await recordLeadNotificationState(
          slug,
          sharedLead.id,
          {
            status: 'accepted',
            provider: 'resend',
            provider_id: registryContact.ownerMessageId,
            retryable: false,
            telegram_accepted: false,
            updated_at: new Date().toISOString(),
          },
        );
        if (!recovered) {
          return NextResponse.json(
            {
              ok: false,
              error: "We couldn't confirm your submission. Please try again.",
              code: 'notification_state_persist_failed',
            },
            { status: 503, headers: cors },
          );
        }
        return NextResponse.json(
          {
            ok: true,
            recovered: true,
            lead_id: publicLeadId,
            crm_contact_id: crmContactId,
            owner_message_id: registryContact.ownerMessageId,
          },
          { headers: cors },
        );
      }

      const registryLead = {
        id: sharedLead.id,
        // Registry slugs are intentionally outside the legacy InboundSlug union.
        // The notifier only uses this for the display label and falls back to the
        // raw slug (`INBOUND_SLUG_LABELS[slug] ?? slug`), so the cast is safe.
        slug: slug as InboundSlug,
        name,
        email: email || null,
        phone: phone || null,
        message: message || null,
        source,
        pageUrl: sanitizeText(body.page_url, 2048) || null,
      };
      const [emailReceipt, telegramOk] = await Promise.all([
        notifyOwnerEmailInboundWithReceipt(registryLead).catch((e) => {
          console.error(`[inbound/${slug}/leads] registry email notify failed`, e);
          return { ok: false as const, error: 'resend_request_failed' };
        }),
        notifyOwnerTelegramInbound(registryLead).catch((e) => {
          console.error(`[inbound/${slug}/leads] registry telegram notify failed`, e);
          return false;
        }),
      ]);

      const updatedAt = new Date().toISOString();
      if (!emailReceipt.ok || !emailReceipt.providerId) {
        const emailError = emailReceipt.ok
          ? 'resend_missing_provider_id'
          : emailReceipt.error;
        const failurePersisted = await recordLeadNotificationState(
          slug,
          sharedLead.id,
          {
            status: 'failed',
            provider: 'resend',
            retryable: true,
            telegram_accepted: telegramOk,
            error: emailError,
            updated_at: updatedAt,
          },
        );
        if (!failurePersisted) {
          console.error(`[inbound/${slug}/leads] could not persist retryable notification failure`);
        }
        return NextResponse.json(
          {
            ok: false,
            error: "We saved your request but couldn't notify the team. Please try again.",
            code: 'owner_notification_failed',
          },
          { status: 503, headers: cors },
        );
      }

      if (
        registryContact &&
        !(await persistRegistryOwnerReceipt(
          registryContact,
          sharedLead.id,
          emailReceipt.providerId,
        ))
      ) {
        const failurePersisted = await recordLeadNotificationState(
          slug,
          sharedLead.id,
          {
            status: 'failed',
            provider: 'resend',
            retryable: true,
            telegram_accepted: telegramOk,
            error: 'crm_owner_receipt_persist_failed',
            updated_at: updatedAt,
          },
        );
        if (!failurePersisted) {
          console.error(
            `[inbound/${slug}/leads] could not persist CRM receipt failure`,
          );
        }
        return NextResponse.json(
          {
            ok: false,
            error: "We couldn't confirm your submission. Please try again.",
            code: 'crm_owner_receipt_persist_failed',
          },
          { status: 503, headers: cors },
        );
      }

      const acceptancePersisted = await recordLeadNotificationState(
        slug,
        sharedLead.id,
        {
          status: 'accepted',
          provider: 'resend',
          provider_id: emailReceipt.providerId,
          retryable: false,
          telegram_accepted: telegramOk,
          updated_at: updatedAt,
        },
      );
      if (!acceptancePersisted) {
        return NextResponse.json(
          {
            ok: false,
            error: "We couldn't confirm your submission. Please try again.",
            code: 'notification_state_persist_failed',
          },
          { status: 503, headers: cors },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          lead_id: publicLeadId,
          crm_contact_id: crmContactId,
          owner_message_id: emailReceipt.providerId,
        },
        { headers: cors },
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
      // Lead already captured in analytics.leads above; the legacy per-tenant
      // table needs a business_id we don't have. Capture, don't 500/drop.
      console.warn(`[inbound/${slug}/leads] no omni_businesses row; captured via shared analytics`);
      return NextResponse.json({ ok: true }, { headers: cors });
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
      const rawCreative = sanitizeText(body.referring_creative_id, 64);
      // creative_id is a uuid FK in cross_ad_* tables — only pass it
      // through if it actually looks like a UUID. Free-form strings get
      // dropped to null so the FK insert succeeds.
      const referringCreative = rawCreative && UUID_RE.test(rawCreative) ? rawCreative : null;
      if (referringSlug && referringSlug !== slug) {
        const refIns = await sb.from('cross_brand_referrals').insert({
          originating_slug: referringSlug,
          target_slug: slug,
          creative_id: referringCreative,
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
        if (refIns.error) {
          console.warn(`[inbound/${slug}/leads] cross_brand_referrals insert failed:`, refIns.error);
        }
        // Also drop a conversion row for the dashboard funnel rollups.
        if (referringCreative) {
          const cvrIns = await sb.from('cross_ad_conversions').insert({
            creative_id: referringCreative,
            originating_slug: referringSlug,
            target_slug: slug,
            target_event_type: 'lead_form_submit',
            value_usd: null,
          });
          if (cvrIns.error) {
            console.warn(`[inbound/${slug}/leads] cross_ad_conversions insert failed:`, cvrIns.error);
          }
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
