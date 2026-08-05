import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { sanitizeText, isValidEmail } from '@/lib/validation';
import { buildWelcomeEmail } from '@/lib/subscribe-welcome';

// Several /subscribe forms across the federation POST a brand-friendly slug that
// is NOT a registered tenant (e.g. `utahmainstreet`, `omni`, `mythos`). Without
// this map the ingest 404s and every one of those subscribers is silently
// dropped. Map each to its canonical registered tenant for capture; the ORIGINAL
// slug is still used to brand the welcome email so the subscriber sees the right
// business name.
const SUBSCRIBE_SLUG_ALIAS: Record<string, string> = {
  utahmainstreet: 'mainst',
  omni: 'omnileads',
  mythos: 'omnileads',
  mythosais: 'omnileads',
  theixnetwork: 'omnileads',
  obsidiancasino: 'omnileads',
};

/**
 * Resolve the tenant a request should be recorded against.
 *
 * The registry wins over the alias map. An alias is only a fallback for a
 * brand-friendly slug that is NOT itself a registered tenant — once a brand
 * gets its own analytics.tenants row, aliasing it would silently file its
 * traffic under someone else's slug. `mythosais` and `theixnetwork` did exactly
 * that: both became real tenants, and every event kept landing on `omnileads`.
 * Checking the registry first makes the map self-healing, so a future brand
 * being registered can never resurrect this bug.
 */
async function resolveTenantSlug(rawSlug: string): Promise<string> {
  const alias = SUBSCRIBE_SLUG_ALIAS[rawSlug];
  if (!alias) return rawSlug;
  return (await isActiveTenant(rawSlug)) ? rawSlug : alias;
}

async function syncResendContact(email: string, firstName?: string | null): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const res = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        ...(firstName ? { first_name: firstName } : {}),
        unsubscribed: false,
      }),
    });
    if (!res.ok && res.status !== 409) {
      console.error(`[newsletter] Resend contact sync failed: ${res.status}`);
    }
  } catch (err) {
    console.error('[newsletter] Resend contact sync failed:', err);
  }
}

async function persistFederationSubscriber(input: {
  site: string;
  email: string;
  firstName?: string | null;
  source?: string | null;
}): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const { error } = await sb
      .from('federation_newsletter_subscribers')
      .upsert(
        {
          site: input.site,
          email: input.email,
          first_name: input.firstName || null,
          source: input.source || 'subscribe',
          unsubscribed: false,
        },
        { onConflict: 'site,email' },
      );
    if (error) {
      console.error(`[newsletter] federation subscriber persist failed: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[newsletter] federation subscriber persist failed:', err);
    return false;
  }
}
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  INBOUND_ORIGINS,
  isInboundSlug,
  pickAllowedOrigin,
  type InboundSlug,
} from '@/lib/inbound-types';
import {
  isActiveTenant,
  tenantOrigins,
  recordEvent,
  recordLead,
  recordNewsletter,
} from '@/lib/server/analytics-ingest';

/** CORS for registry-driven (non-legacy) tenants — origins come from analytics.tenants. */
function registryCors(origins: string[], origin: string | null): HeadersInit {
  const ok = origin && origins.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : origins[0] ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

type SfdAnonymousEvent = {
  event_type: 'page_view' | 'click' | 'scroll';
  event_category: string;
  action: string;
  page_url: string;
  value_numeric?: number;
  properties: Record<string, never>;
};

const SFD_PAGE_VIEW_CATEGORIES = new Set(['navigation', 'content']);
const SFD_CLICK_CATEGORIES = new Set([
  'click',
  'nav',
  'hero',
  'footer',
  'cta',
  'sticky',
  'offerings',
  'shop',
  'network_store',
]);
const SFD_PAGE_PATHS = new Set(['/', '/about', '/privacy', '/shop', '/subscribe', '/terms']);
const SFD_PROTECTED_KEYS = new Set([
  'email',
  'phone',
  'telephone',
  'mobile',
  'artistname',
  'fullname',
  'firstname',
  'lastname',
  'name',
  'address',
  'streetaddress',
  'postaladdress',
  'birthdate',
  'dateofbirth',
  'message',
  'consent',
  'consentterms',
]);
const SFD_EMAIL_FRAGMENT = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/i;

function hasSfdPhoneFragment(value: string): boolean {
  // Remove ISO calendar dates before looking for 10-15 digit phone groups so
  // an ordinary timestamp never gets mistaken for contact information.
  const withoutDates = value.replace(/\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-Z]+)?\b/gi, '');
  const candidates = withoutDates.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  });
}

function hasSfdContactFragment(value: string): boolean {
  const variants = [value];
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) variants.push(decoded);
  } catch {
    // Invalid percent encoding cannot bypass the raw-string check. Unknown
    // values are discarded by the anonymous event allowlist regardless.
  }
  return variants.some(
    (candidate) => SFD_EMAIL_FRAGMENT.test(candidate) || hasSfdPhoneFragment(candidate),
  );
}

/**
 * Reject contact/form data at any nesting level before the analytics event is
 * rebuilt. Unknown safe properties are dropped; protected keys, encoded
 * emails, and formatted phone numbers fail closed instead of being logged.
 */
function hasProtectedSfdAnalyticsData(value: unknown): boolean {
  let inspected = 0;
  const inspect = (candidate: unknown, depth: number): boolean => {
    inspected += 1;
    if (inspected > 500 || depth > 8) return true;
    if (typeof candidate === 'string') return hasSfdContactFragment(candidate);
    if (!candidate || typeof candidate !== 'object') return false;
    if (Array.isArray(candidate)) return candidate.some((item) => inspect(item, depth + 1));
    return Object.entries(candidate as Record<string, unknown>).some(([key, child]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
      return SFD_PROTECTED_KEYS.has(normalizedKey) || inspect(child, depth + 1);
    });
  };
  return inspect(value, 0);
}

function safeSfdPagePath(value: unknown): string | null {
  const raw = sanitizeText(value, 2048);
  if (!raw || hasSfdContactFragment(raw)) return null;
  try {
    const url = new URL(raw, 'https://sfdempire.com');
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== '' ||
      (url.hostname !== 'sfdempire.com' && url.hostname !== 'www.sfdempire.com')
    ) {
      return null;
    }
    const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
    return SFD_PAGE_PATHS.has(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * SFD's anonymous endpoint is analytics-only. Build a new object from a small
 * allowlist instead of trying to discover PII inside attacker-controlled JSON.
 * Unknown and nested properties are discarded and can never reach Postgres.
 */
function sanitizeSfdAnonymousEvent(body: Record<string, unknown>): SfdAnonymousEvent | null {
  if (hasProtectedSfdAnalyticsData(body)) return null;
  const eventType = sanitizeText(body.event_type, 20).toLowerCase();
  const category = sanitizeText(body.event_category, 50).toLowerCase();
  const pagePath = safeSfdPagePath(body.page_url);
  if (!pagePath) return null;

  let action: string | null = null;
  let valueNumeric: number | undefined;
  if (eventType === 'page_view') {
    if (!SFD_PAGE_VIEW_CATEGORIES.has(category)) return null;
    action = category === 'navigation' ? 'render' : 'view';
  } else if (eventType === 'click') {
    if (!SFD_CLICK_CATEGORIES.has(category)) return null;
    action = 'activate';
  } else if (eventType === 'scroll') {
    if (category !== 'engagement' || ![25, 50, 75, 100].includes(Number(body.value_numeric))) {
      return null;
    }
    valueNumeric = Number(body.value_numeric);
    action = `${valueNumeric}%`;
  } else {
    // Form submissions, signups, and arbitrary custom event types belong on
    // an authenticated receiver, never this public analytics endpoint.
    return null;
  }
  if (!action) return null;

  return {
    event_type: eventType,
    event_category: category,
    action,
    page_url: pagePath,
    ...(valueNumeric !== undefined ? { value_numeric: valueNumeric } : {}),
    // Do not copy caller-controlled properties, IDs, targets, referrers, UTM
    // values, or free-form text. This guarantees nested objects and PII cannot
    // cross the anonymous SFD analytics boundary.
    properties: {},
  };
}

/**
 * Generic inbound analytics ingestion. Drop-in replacement for the bespoke
 * /api/cps/events endpoint, parameterised by slug. Mounted on each client
 * personal website via <InboundTracker slug="..." />.
 *
 * Writes to the inbound_<slug>_events table. Slug must be in INBOUND_SLUGS;
 * unknown slugs return 404 with no CORS so they can't be probed.
 *
 * Rate-limited at 240 req/min/IP/slug — same as the CPS bespoke endpoint.
 */

function corsHeaders(slug: InboundSlug, origin: string | null): HeadersInit {
  const allowed = INBOUND_ORIGINS[slug];
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : pickAllowedOrigin(slug, origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = await resolveTenantSlug(rawSlug);
  const origin = request.headers.get('origin');
  if (!isInboundSlug(slug)) {
    if (!(await isActiveTenant(slug))) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 204, headers: registryCors(await tenantOrigins(slug), origin) });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(slug, origin),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = await resolveTenantSlug(rawSlug);
  const origin = request.headers.get('origin');
  let sfdAnonymousEvent: SfdAnonymousEvent | null = null;

  // SFD contact data is accepted only by the fixed-project authenticated
  // receiver. Rebuild every anonymous event from a strict allowlist above both
  // registry and legacy branches so future routing changes cannot reopen the
  // public form pipeline or persist arbitrary nested properties.
  if (slug === 'sfdempire') {
    const candidate = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;
    sfdAnonymousEvent = sanitizeSfdAnonymousEvent(candidate);
    if (!sfdAnonymousEvent) {
      const origins = await tenantOrigins(slug);
      return NextResponse.json(
        { ok: false, error: 'authenticated_forms_endpoint_required' },
        { status: 403, headers: registryCors(origins, origin) },
      );
    }
  }

  // Registry-driven path: a non-legacy but active registry tenant (all the
  // newer brands) writes ONLY to the shared analytics schema. The legacy
  // per-tenant path below stays byte-for-byte unchanged for existing sites.
  if (!isInboundSlug(slug)) {
    if (!(await isActiveTenant(slug))) {
      return NextResponse.json({ error: 'Unknown brand' }, { status: 404 });
    }
    const rcors = registryCors(await tenantOrigins(slug), origin);
    try {
      const b = (sfdAnonymousEvent ??
        (await request.json().catch(() => ({})))) as Record<string, unknown>;
      const props = b.properties && typeof b.properties === 'object'
        ? b.properties as Record<string, unknown>
        : {};
      await recordEvent({
        slug,
        event_type: sanitizeText(b.event_type, 50) || 'page_view',
        event_category: sanitizeText(b.event_category, 50) || 'navigation',
        action: sanitizeText(b.action, 50) || 'view',
        page_url: sanitizeText(b.page_url, 2048) || undefined,
        target_id: sanitizeText(b.target_id, 200) || undefined,
        value_text: sanitizeText(b.value_text, 500) || undefined,
        value_numeric: typeof b.value_numeric === 'number' ? b.value_numeric : undefined,
        visitor_id: sanitizeText(b.visitor_id, 100) || undefined,
        session_id: sanitizeText(b.session_id, 100) || undefined,
        props: props as Record<string, unknown>,
      });
      const rawEmail =
        (typeof (props as { email?: unknown }).email === 'string'
          ? (props as { email: string }).email
          : b.event_category === 'subscribe' && typeof b.value_text === 'string'
            ? b.value_text
            : '') || '';
      const email = sanitizeText(rawEmail, 254).toLowerCase();
      if (email && isValidEmail(email)) {
        const firstName = sanitizeText((props as { name?: string }).name, 120) || null;
        await persistFederationSubscriber({
          site: slug,
          email,
          firstName,
          source: sanitizeText((props as { source?: string }).source, 120) || rawSlug,
        });
        await recordNewsletter({ slug, email, action: 'subscribe', props: props as Record<string, unknown> });
        await recordLead({
          slug,
          email,
          name: firstName || email.split('@')[0],
          source: 'subscribe',
          dedup_key: `sub:${email}`,
          props: props as Record<string, unknown>,
        });
        await syncResendContact(email, firstName);
      }
    } catch (err) {
      console.error(`[inbound/${slug}/events] registry path failed:`, err);
    }
    return NextResponse.json({ ok: true }, { headers: rcors });
  }

  const cors = corsHeaders(slug, origin);

  try {
    const hdrs = await headers();
    const referer = hdrs.get('referer') || hdrs.get('referrer') || null;
    const forwarded = hdrs.get('x-forwarded-for') || hdrs.get('x-real-ip') || null;
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    const rl = rateLimit(`inbound-events:${slug}:${ip || 'unknown'}`, 240, 60 * 1000);
    if (!rl.ok) {
      const r = rateLimitResponse(rl.resetMs);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
      return r;
    }

    const body = (sfdAnonymousEvent ??
      await request.json().catch(() => ({}))) as Record<string, unknown>;

    const clientProps =
      body.properties && typeof body.properties === 'object'
        ? body.properties as Record<string, unknown>
        : {};

    // Cap properties JSON to 4KB so a malicious payload can't bloat rows.
    let safeProps: Record<string, unknown> = clientProps;
    try {
      const serialized = JSON.stringify(clientProps);
      if (serialized.length > 4096) {
        safeProps = { _truncated: true, _size: serialized.length };
      }
    } catch {
      safeProps = { _truncated: true, _reason: 'unserializable' };
    }

    const fallbackHost = INBOUND_ORIGINS[slug][0] ?? 'https://omnileadsagi.com';
    const pageUrl = sanitizeText(body.page_url, 2048) || referer || undefined;
    let pagePath: string | undefined;
    try {
      if (pageUrl) pagePath = new URL(pageUrl, fallbackHost).pathname;
    } catch {
      pagePath = undefined;
    }

    // Phone-click detection — same logic as CPS, used by the dashboard's
    // "calls received" widget.
    const targetIdRaw = sanitizeText(body.target_id, 200);
    const propsHref =
      typeof (clientProps as { href?: unknown }).href === 'string'
        ? ((clientProps as { href: string }).href)
        : '';
    const isPhoneClick =
      body.event_type === 'click' &&
      (propsHref.startsWith('tel:') || /^tel:/i.test(targetIdRaw || ''));
    const phoneNumber = isPhoneClick
      ? (propsHref.replace(/^tel:/, '') || targetIdRaw.replace(/^tel:/, '')).slice(0, 50)
      : null;

    // data-track-area lets us group click counts by region (nav / hero /
    // footer / etc.) in the dashboard "top buttons" widget. The tracker
    // includes it inside `properties.area` when present.
    const areaRaw =
      typeof (clientProps as { area?: unknown }).area === 'string'
        ? sanitizeText((clientProps as { area: string }).area, 50)
        : null;

    // Shared-analytics capture FIRST (direct pg — bypasses the PostgREST path
    // below) so legacy sites keep capturing even when the schema cache is sick.
    // This is the forward sink the new dashboard reads.
    await recordEvent({
      slug,
      event_type: sanitizeText(body.event_type, 50) || 'page_view',
      event_category: sanitizeText(body.event_category, 50) || 'navigation',
      action: sanitizeText(body.action, 50) || 'view',
      page_url: pageUrl || undefined,
      target_id: targetIdRaw || undefined,
      value_text: sanitizeText(body.value_text, 500) || undefined,
      value_numeric: typeof body.value_numeric === 'number' ? body.value_numeric : undefined,
      visitor_id: sanitizeText(body.visitor_id, 100) || undefined,
      session_id: sanitizeText(body.session_id, 100) || undefined,
      props: safeProps,
    });

    const sb = createAdminClient();
    const tableName = `inbound_${slug}_events`;

    // Same business_id resolution as the leads route — inbound_<slug>_events
    // also declares business_id NOT NULL with no default, so every insert
    // has to pass it explicitly. Without this, fresh tenants 500 silently.
    const { data: bizRow } = await sb
      .from('omni_businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    const businessId = bizRow?.id ?? null;
    if (!businessId) {
      // Event already captured in analytics.events above (direct pg). The legacy
      // per-tenant table needs a business_id we couldn't resolve (often a degraded
      // PostgREST schema cache). Don't 500 — capture already succeeded.
      console.warn(`[inbound/${slug}/events] no omni_businesses row; captured via shared analytics`);
      return NextResponse.json({ ok: true }, { headers: cors });
    }

    try {
      const { error } = await sb.from(tableName).insert({
      business_id: businessId,
      visitor_id: sanitizeText(body.visitor_id, 100) || null,
      session_id: sanitizeText(body.session_id, 100) || null,
      event_type: sanitizeText(body.event_type, 50) || 'page_view',
      event_category: sanitizeText(body.event_category, 50) || 'navigation',
      action: sanitizeText(body.action, 50) || 'view',
      target_type: sanitizeText(body.target_type, 50) || null,
      target_id: targetIdRaw || null,
      target_area: areaRaw,
      page_url: pageUrl || null,
      // Existing inbound_<slug>_events tables use `path` (not page_path).
      path: pagePath || null,
      is_phone_click: isPhoneClick,
      phone_number: phoneNumber,
      ip_address: ip,
      user_agent:
        sanitizeText(body.user_agent, 500) ||
        hdrs.get('user-agent')?.slice(0, 500) ||
        null,
      referrer:
        (typeof (clientProps as { referrer?: unknown }).referrer === 'string'
          ? sanitizeText((clientProps as { referrer?: unknown }).referrer, 2048)
          : null) || referer,
      value_text: sanitizeText(body.value_text, 500) || null,
      value_numeric: typeof body.value_numeric === 'number' ? body.value_numeric : null,
      duration_ms: typeof body.duration_ms === 'number' ? body.duration_ms : null,
      // Existing inbound_<slug>_events tables use `payload` jsonb.
      payload: safeProps,
      });
      if (error) console.error(`[inbound/${slug}/events] insert error:`, error);
    } catch (evErr) {
      // Analytics insert is best-effort — an intermittent DB timeout must never
      // 500 the tracker or, worse, drop the subscriber capture + welcome email
      // below. We log and continue so signups + notifications still go out.
      console.error(`[inbound/${slug}/events] events insert failed (best-effort):`, evErr);
    }

    // ── Subscriber capture ─────────────────────────────────────────────
    // A subscribe event carries the email in properties.email (or value_text).
    // Previously it was only logged as anonymous analytics and the email was
    // dropped — so /subscribe forms never actually built a list. Persist a
    // valid email into inbound_<slug>_leads (the existing lead table) so every
    // signup is captured. Idempotent per email; never breaks the analytics 200.
    const rawEmail =
      (typeof (clientProps as { email?: unknown }).email === 'string'
        ? (clientProps as { email: string }).email
        : body.event_category === 'subscribe' && typeof body.value_text === 'string'
          ? body.value_text
          : '') || '';
    const email = sanitizeText(rawEmail, 254).toLowerCase();
    if (email && isValidEmail(email)) {
      const leadsTable = `inbound_${slug}_leads`;
      const propStr = (k: string, max: number) =>
        typeof (clientProps as Record<string, unknown>)[k] === 'string'
          ? sanitizeText((clientProps as Record<string, string>)[k], max)
          : null;
      // full_name is NOT NULL on the leads tables — fall back to the email's
      // local part so a bare-email subscribe still persists.
      const fullName =
        propStr('name', 120) || propStr('full_name', 120) || email.split('@')[0].slice(0, 120);
      const source =
        propStr('source', 50) ||
        propStr('list', 50) ||
        sanitizeText(body.event_category, 50) ||
        'subscribe';
      const utmSource = propStr('utm_source', 100) || sanitizeText(body.utm_source, 100) || null;

      // Durable PostgREST-backed record. This remains available when the direct
      // Postgres analytics sink is unreachable, and it is the dashboard's
      // canonical newsletter source.
      await persistFederationSubscriber({ site: slug, email, firstName: fullName, source });

      // Shared newsletter + lead records are what the Agentic Dashboard reads.
      // Write them for legacy tenants too, not only registry-driven tenants.
      await recordNewsletter({ slug, email, action: 'subscribe', props: safeProps });
      await recordLead({
        slug,
        email,
        name: fullName,
        source: 'subscribe',
        dedup_key: `sub:${email}`,
        props: safeProps,
      });
      await syncResendContact(email, fullName);

      // Persist the lead — best-effort. If the DB is slow/unavailable we STILL
      // send the emails below: a database blip must never swallow a subscriber's
      // welcome email or the owner alert. `alreadyKnown` stays false when the
      // dedup check can't run, so notifications fail OPEN (may re-send on a
      // repeat submit during an outage — an acceptable trade for reliability).
      let alreadyKnown = false;
      try {
        const { data: existing } = await sb
          .from(leadsTable)
          .select('id')
          .eq('email', email)
          .limit(1)
          .maybeSingle();
        alreadyKnown = !!existing;
        if (!existing) {
          await sb.from(leadsTable).insert({
            business_id: businessId,
            full_name: fullName,
            email,
            source,
            page_path: pagePath || null,
            utm_source: utmSource,
          });
        }
      } catch (capErr) {
        console.error(`[inbound/${slug}/events] subscribe capture skipped:`, capErr);
      }

      if (!alreadyKnown && process.env.RESEND_API_KEY) {
        // ── Owner notification — email the operator who just subscribed. ──
        try {
          const notifyTo = process.env.SUBSCRIBER_NOTIFY_EMAIL || 'sitanim8@gmail.com';
          const from = process.env.RESEND_FROM || 'Omni AI <alfred@omnileadsagi.com>';
          const site = INBOUND_ORIGINS[slug]?.[0] || 'https://omnileadsagi.com';
          const brandLabel = rawSlug === slug ? slug : `${rawSlug} → ${slug}`;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from,
              to: notifyTo,
              reply_to: email,
              subject: `New subscriber: ${email} — ${rawSlug}`,
              text: [
                `New ${brandLabel} subscriber`,
                '',
                `Email:  ${email}`,
                `Name:   ${fullName}`,
                `List:   ${source}`,
                `Site:   ${site}`,
                `Page:   ${pagePath || '—'}`,
                `Source: ${utmSource || 'direct'}`,
                `Time:   ${new Date().toISOString()}`,
              ].join('\n'),
            }),
          });
        } catch (mailErr) {
          console.error(`[inbound/${slug}/events] subscribe notify skipped:`, mailErr);
        }

        // ── Subscriber welcome — branded for the specific business joined. ──
        try {
          const welcome = buildWelcomeEmail(rawSlug, clientProps as Record<string, unknown>);
          if (welcome) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `${welcome.fromName} <newsletter@omnios.news>`,
                to: email,
                subject: welcome.subject,
                html: welcome.html,
                text: welcome.text,
              }),
            });
          }
        } catch (welErr) {
          console.error(`[inbound/${slug}/events] welcome email skipped:`, welErr);
        }
      }
    }

    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error(`[inbound/${slug}/events] failed:`, e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors });
  }
}
