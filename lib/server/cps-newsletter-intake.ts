import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getBusinessSlugForFederationSite,
  getFederationBrief,
} from '@/lib/federation-newsletter-briefs';
import { buildFederationUnsubscribeUrl } from '@/lib/server/cps-newsletter-token';
import { verifyVercelProjectToken } from '@/lib/server/vercel-oidc';
import {
  cpsWelcomeAcceptanceUnknownState,
  cpsOwnerAcceptanceUnknownState,
  cpsEmailProviderFailure,
} from '@/lib/server/cps-newsletter-policy';
import { getClientIp, rateLimit } from '@/lib/rate-limit';


/** Isolated, release-gated CPS newsletter intake. Other federation workflows are untouched. */

function resendApiKey(): string {
  return process.env.RESEND_API_KEY || '';
}
const CPS_SITE = 'cps';
const CPS_SOURCE = 'cpsutah.org';
const CPS_OWNER_RECIPIENT = 'sitanim8@gmail.com';
const CPS_LOCAL_SOURCE_HEADER = 'x-cps-local-source';
const CPS_CLIENT_IP_HASH_HEADER = 'x-cps-client-ip-hash';
const CPS_SUBSCRIBER_FIELDS =
  'id,site,email,first_name,source,unsubscribed,unsubscribed_at,subscription_state,consent_epoch,last_subscribed_at,unsubscribe_token_expires_at,welcome_status,welcome_idempotency_key,welcome_message_id,welcome_last_attempt_at,welcome_accepted_at,welcome_error_code,owner_status,owner_idempotency_key,owner_message_id,owner_last_attempt_at,owner_accepted_at,owner_error_code';

type WelcomeStatus =
  | 'pending'
  | 'sending'
  | 'accepted'
  | 'failed'
  | 'unknown'
  | 'not_required';

type CpsSubscriber = {
  id: string;
  site: string;
  email: string;
  first_name: string | null;
  source: string | null;
  unsubscribed: boolean;
  unsubscribed_at: string | null;
  subscription_state: 'pending' | 'active' | 'unsubscribed';
  consent_epoch: string;
  last_subscribed_at: string;
  unsubscribe_token_expires_at: number;
  welcome_status: WelcomeStatus;
  welcome_idempotency_key: string | null;
  welcome_message_id: string | null;
  welcome_last_attempt_at: string | null;
  welcome_accepted_at: string | null;
  welcome_error_code: string | null;
  owner_status: WelcomeStatus;
  owner_idempotency_key: string | null;
  owner_message_id: string | null;
  owner_last_attempt_at: string | null;
  owner_accepted_at: string | null;
  owner_error_code: string | null;
};

type CpsCompletion =
  | 'new_welcome_accepted'
  | 'already_subscribed'
  | 'reactivated_welcome_accepted';

type WelcomeResult =
  | { ok: true; messageId: string }
  | { ok: false; retryable: boolean; deliveryUnknown: boolean; code: string };

export function cpsSubscriptionHasAcceptedReceipts(subscriber: Pick<CpsSubscriber,
  'welcome_status' | 'welcome_message_id' | 'welcome_accepted_at' |
  'owner_status' | 'owner_message_id' | 'owner_accepted_at'
> | null | undefined): boolean {
  return Boolean(subscriber &&
    subscriber.welcome_status === 'accepted' && subscriber.welcome_message_id && subscriber.welcome_accepted_at &&
    subscriber.owner_status === 'accepted' && subscriber.owner_message_id && subscriber.owner_accepted_at);
}

function cpsSubscriptionIsComplete(subscriber: CpsSubscriber | null | undefined): boolean {
  return Boolean(subscriber && subscriber.subscription_state === 'active' && !subscriber.unsubscribed &&
    cpsSubscriptionHasAcceptedReceipts(subscriber));
}

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set(
    'Access-Control-Allow-Headers',
    `content-type, authorization, ${CPS_LOCAL_SOURCE_HEADER}, ${CPS_CLIENT_IP_HASH_HEADER}`,
  );
  return res;
}

function hashRateLimitValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function cpsRateLimitFailure(resetMs: number): NextResponse {
  const response = cpsError(
    'Too many subscription attempts. Please try again later.',
    429,
    'rate_limited',
  );
  response.headers.set(
    'Retry-After',
    String(Math.max(1, Math.ceil(resetMs / 1000))),
  );
  return response;
}

function enforceCpsRateLimit(
  request: Request,
  email: string,
): NextResponse | null {
  const forwardedHash = request.headers
    .get(CPS_CLIENT_IP_HASH_HEADER)
    ?.trim()
    .toLowerCase();
  const ipKey =
    forwardedHash && /^[a-f0-9]{64}$/.test(forwardedHash)
      ? forwardedHash
      : hashRateLimitValue(getClientIp(request.headers));
  const ipLimit = rateLimit(`cps-newsletter-ip:${ipKey}`, 20, 10 * 60 * 1000);
  if (!ipLimit.ok) return cpsRateLimitFailure(ipLimit.resetMs);

  const emailKey = hashRateLimitValue(email);
  const emailLimit = rateLimit(
    `cps-newsletter-email:${emailKey}`,
    5,
    60 * 60 * 1000,
  );
  if (!emailLimit.ok) return cpsRateLimitFailure(emailLimit.resetMs);
  return null;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function isValidEmail(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  // Loose RFC-leaning check — enough to filter obvious garbage without
  // rejecting valid addresses with + tags, dots, or punycode domains.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function resolveCpsNewsletterOwnerRecipient(value: unknown): string {
  const candidate = clean(value, 254).toLowerCase();
  return candidate === CPS_OWNER_RECIPIENT ? candidate : '';
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      (
        {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        } as Record<string, string>
      )[character],
  );
}

function cpsError(
  error: string,
  status: number,
  code: string,
): NextResponse {
  return withCors(
    NextResponse.json({ ok: false, error, code }, { status }),
  );
}

function secretsEqual(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

async function isCpsAuthorized(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const localSourceSecret = process.env.CPS_LOCAL_SOURCE_SECRET || '';
  const loopbackDevelopment =
    process.env.NODE_ENV === 'development' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
    Boolean(localSourceSecret) &&
    secretsEqual(
      request.headers.get(CPS_LOCAL_SOURCE_HEADER),
      localSourceSecret,
    );
  if (loopbackDevelopment) return true;

  const token =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token) return false;
  return verifyVercelProjectToken(token, {
    ownerId: 'team_jvhwfBn81nJXTMX0DEvwQCuA',
    projectId: 'prj_0BXjSD05cmHJuj0pZYwkTL0DB7dA',
    projectName: 'cpsutah',
    environment: 'production',
  });
}

async function loadCpsSubscriber(
  sb: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ row: CpsSubscriber | null; error: boolean }> {
  const { data, error } = await sb
    .from('federation_newsletter_subscribers')
    .select(CPS_SUBSCRIBER_FIELDS)
    .eq('site', CPS_SITE)
    .eq('email', email)
    .maybeSingle();
  return {
    row: (data as CpsSubscriber | null) ?? null,
    error: Boolean(error),
  };
}

async function persistCpsSubscriberState(
  sb: ReturnType<typeof createAdminClient>,
  subscriberId: string,
  consentEpoch: string,
  values: Record<string, unknown>,
  expectedSubscriptionState?: CpsSubscriber['subscription_state'],
  expectedNotification?: {
    column: 'welcome_status' | 'owner_status';
    status: WelcomeStatus;
  },
): Promise<boolean> {
  let update = sb
    .from('federation_newsletter_subscribers')
    .update(values)
    .eq('id', subscriberId)
    .eq('consent_epoch', consentEpoch);
  if (expectedSubscriptionState) {
    update = update.eq('subscription_state', expectedSubscriptionState);
  }
  if (expectedNotification) {
    update = update.eq(
      expectedNotification.column,
      expectedNotification.status,
    );
  }
  const { data, error } = await update.select('id').maybeSingle();
  return !error && typeof data?.id === 'string';
}

async function authorizeCpsDelivery(
  sb: ReturnType<typeof createAdminClient>,
  subscriber: CpsSubscriber,
): Promise<NextResponse | null> {
  const { data, error } = await sb.rpc(
    'authorize_cps_newsletter_delivery',
    {
      p_subscriber_id: subscriber.id,
      p_consent_epoch: subscriber.consent_epoch,
    },
  );
  if (error || !['allowed', 'blocked', 'stale'].includes(String(data))) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'suppression_lookup_unavailable',
    );
  }
  if (data === 'blocked') {
    return cpsError(
      'This address cannot be subscribed right now. Please contact CPS.',
      409,
      'suppression_added_during_subscription',
    );
  }
  if (data === 'stale') {
    return cpsError(
      'This subscription request is no longer current. Please try again.',
      409,
      'consent_epoch_stale',
    );
  }
  return null;
}

async function sendCpsWelcome(
  subscriber: CpsSubscriber,
  brandName: string,
  websiteUrl: string,
  fromEmail: string,
  replyTo: string,
): Promise<WelcomeResult> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      retryable: true,
      deliveryUnknown: false,
      code: 'provider_not_configured',
    };
  }
  if (!subscriber.welcome_idempotency_key) {
    return {
      ok: false,
      retryable: false,
      deliveryUnknown: false,
      code: 'welcome_key_missing',
    };
  }

  const safeBrand = escapeHtml(brandName);
  const safeWebsiteUrl = escapeHtml(websiteUrl);
  const unsubscribeUrl = buildFederationUnsubscribeUrl(
    subscriber.email,
    CPS_SITE,
    'https://omnileadsagi.com',
    subscriber.unsubscribe_token_expires_at,
  );
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  const subject = `Welcome to ${brandName}`;
  const text = [
    "You're on the list.",
    '',
    `Thanks for joining us. Resources and updates from ${brandName} will arrive as they are published.`,
    '',
    `Visit ${brandName}: ${websiteUrl}`,
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
  ].join('\n');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#fbf6f6;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2b171a;">
    <div style="max-width:600px;margin:0 auto;padding:34px 18px;">
      <div style="background:#fff;border:1px solid #edd4d7;border-top:4px solid #A1252B;padding:38px 38px 32px;">
        <p style="margin:0 0 18px;color:#7F1C22;font-size:11px;font-weight:900;letter-spacing:2.2px;text-transform:uppercase;">${safeBrand} · Welcome</p>
        <h1 style="margin:0;font-size:34px;line-height:1.08;color:#2b171a;">You're on the list.</h1>
        <p style="margin:20px 0 0;font-size:17px;line-height:1.65;color:#5f474b;">Thanks for joining us. Resources and updates from ${safeBrand} will arrive as they are published.</p>
        <p style="margin:28px 0 0;"><a href="${safeWebsiteUrl}" style="display:inline-block;background:#7F1C22;color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:13px 20px;border-radius:8px;">Visit ${safeBrand}</a></p>
        <p style="margin:32px 0 0;padding-top:18px;border-top:1px solid #edd4d7;color:#6f5559;font-size:12px;line-height:1.6;">You subscribed at cpsutah.org. You can <a href="${safeUnsubscribeUrl}" style="color:#7F1C22;">unsubscribe in one click</a> at any time.</p>
      </div>
    </div>
  </body></html>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': subscriber.welcome_idempotency_key,
      },
      body: JSON.stringify({
        from: `${brandName} <${fromEmail}>`,
        reply_to: replyTo,
        to: [subscriber.email],
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = (await response.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
    } | null;
    if (response.ok && typeof result?.id === 'string' && result.id) {
      return { ok: true, messageId: result.id };
    }
    const providerErrorName =
      typeof result?.name === 'string' ? result.name : '';
    return {
      ok: false,
      ...cpsEmailProviderFailure(
        'welcome',
        response.status,
        providerErrorName,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      deliveryUnknown: true,
      code: error instanceof Error && error.name === 'AbortError'
        ? 'welcome_provider_timeout'
        : 'welcome_provider_unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendCpsOwnerNotification(
  subscriber: CpsSubscriber,
  ownerEmail: string,
  fromEmail: string,
): Promise<WelcomeResult> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      retryable: true,
      deliveryUnknown: false,
      code: 'provider_not_configured',
    };
  }
  if (!subscriber.owner_idempotency_key) {
    return {
      ok: false,
      retryable: false,
      deliveryUnknown: false,
      code: 'owner_key_missing',
    };
  }

  const safeEmail = escapeHtml(subscriber.email);
  const safeName = escapeHtml(subscriber.first_name || 'Not provided');
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#211719;">
    <h1 style="font-size:22px;color:#A1252B;">New Clinical and Professional Solutions newsletter subscriber</h1>
    <p>A visitor completed the Clinical and Professional Solutions newsletter signup flow.</p>
    <dl>
      <dt style="font-weight:700;">Email</dt><dd>${safeEmail}</dd>
      <dt style="font-weight:700;">First name</dt><dd>${safeName}</dd>
      <dt style="font-weight:700;">Source</dt><dd>cpsutah.org</dd>
    </dl>
  </body></html>`;
  const text = [
    'New Clinical and Professional Solutions newsletter subscriber',
    '',
    `Email: ${subscriber.email}`,
    `First name: ${subscriber.first_name || 'Not provided'}`,
    'Source: cpsutah.org',
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': subscriber.owner_idempotency_key,
      },
      body: JSON.stringify({
        from: `Clinical and Professional Solutions Website <${fromEmail}>`,
        reply_to: subscriber.email,
        to: [ownerEmail],
        subject: 'New Clinical and Professional Solutions newsletter subscriber',
        html,
        text,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = (await response.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
    } | null;
    if (response.ok && typeof result?.id === 'string' && result.id) {
      return { ok: true, messageId: result.id };
    }
    const providerErrorName =
      typeof result?.name === 'string' ? result.name : '';
    return {
      ok: false,
      ...cpsEmailProviderFailure('owner', response.status, providerErrorName),
    };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      deliveryUnknown: true,
      code:
        error instanceof Error && error.name === 'AbortError'
          ? 'owner_provider_timeout'
          : 'owner_provider_unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleCpsSubscription(
  request: Request,
  body: {
    email?: unknown;
    first_name?: unknown;
    source?: unknown;
    website?: unknown;
  },
): Promise<NextResponse> {
  if (!(await isCpsAuthorized(request))) {
    return cpsError('Unauthorized.', 401, 'unauthorized');
  }

  const email = clean(body.email, 254).toLowerCase();
  const firstName = clean(body.first_name, 80) || null;
  const source = clean(body.source, 40).toLowerCase();
  if (!isValidEmail(email) || source !== CPS_SOURCE) {
    return cpsError('Invalid subscription request.', 400, 'invalid_request');
  }

  // This authenticated no-write path exercises caller -> receiver without
  // touching Supabase or Resend. It is available only through the caller's
  // honeypot field and is the production-safe release smoke test.
  if (clean(body.website, 200)) {
    return withCors(
      NextResponse.json({
        ok: true,
        no_write: true,
        completion: 'no_write',
      }),
    );
  }

  if (process.env.NODE_ENV === 'development' && process.env.CPS_LOCAL_NO_WRITE_ONLY === '1') {
    return cpsError('Local writes are disabled.', 503, 'local_write_disabled');
  }

  const limited = enforceCpsRateLimit(request, email);
  if (limited) return limited;

  const brief = getFederationBrief(CPS_SITE);
  const businessSlug = getBusinessSlugForFederationSite(CPS_SITE);
  const ownerRecipient = resolveCpsNewsletterOwnerRecipient(
    brief?.businessOwnerEmail,
  );
  if (
    !brief ||
    !brief.fromEmail ||
    !isValidEmail(ownerRecipient) ||
    !businessSlug
  ) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'configuration_unavailable',
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !resendApiKey()
  ) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'configuration_unavailable',
    );
  }

  const sb = createAdminClient();
  const { data: suppressionStatus, error: suppressionError } = await sb.rpc(
    'cps_newsletter_suppression_status',
    { p_email: email },
  );
  if (
    suppressionError ||
    !['clear', 'unsubscribe', 'global', 'protected'].includes(
      String(suppressionStatus),
    )
  ) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'suppression_lookup_unavailable',
    );
  }
  if (suppressionStatus === 'global') {
    return cpsError(
      'This address is on a do-not-contact list. Please contact CPS to subscribe again.',
      409,
      'globally_suppressed',
    );
  }
  if (suppressionStatus === 'protected') {
    return cpsError(
      'This address cannot be re-subscribed automatically. Please contact CPS.',
      409,
      'scoped_suppression_requires_review',
    );
  }
  // An explicit CPS unsubscribe stays in place until the welcome and owner
  // notification are both accepted. The finalization RPC clears only that
  // reason in the same transaction that activates the row.

  const existing = await loadCpsSubscriber(sb, email);
  if (existing.error) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'subscriber_lookup_failed',
    );
  }

  const now = new Date().toISOString();
  let subscriber = existing.row;
  let action: 'new' | 'existing' | 'reactivated' | 'pending' = 'existing';

  if (!subscriber) {
    const id = randomUUID();
    const consentEpoch = randomUUID();
    const unsubscribeTokenExpiresAt =
      Math.floor(Date.parse(now) / 1000) + 365 * 24 * 60 * 60;
    const { data, error } = await sb
      .from('federation_newsletter_subscribers')
      .insert({
        id,
        site: CPS_SITE,
        email,
        first_name: firstName,
        source: CPS_SOURCE,
        // Pending rows remain excluded from newsletter fan-out until the
        // welcome and required owner notification are durably accepted.
        unsubscribed: true,
        unsubscribed_at: null,
        subscription_state: 'pending',
        consent_epoch: consentEpoch,
        last_subscribed_at: now,
        unsubscribe_token_expires_at: unsubscribeTokenExpiresAt,
        welcome_status: 'pending',
        welcome_idempotency_key: `cps-welcome/${id}/${consentEpoch}`,
        owner_status: 'pending',
        owner_idempotency_key: `cps-newsletter-owner/${id}/${consentEpoch}`,
      })
      .select(CPS_SUBSCRIBER_FIELDS)
      .single();
    if (error) {
      if (error.code !== '23505') {
        return cpsError(
          'Subscriptions are temporarily unavailable.',
          503,
          'subscriber_write_failed',
        );
      }
      const winner = await loadCpsSubscriber(sb, email);
      if (winner.error || !winner.row) {
        return cpsError(
          'Subscriptions are temporarily unavailable.',
          503,
          'subscriber_race_unresolved',
        );
      }
      subscriber = winner.row;
      action = subscriber.subscription_state === 'active' ? 'existing' : 'pending';
    } else {
      subscriber = data as CpsSubscriber;
      action = 'new';
    }
  } else if (
    subscriber.subscription_state === 'unsubscribed' ||
    (subscriber.subscription_state === 'active' &&
      (suppressionStatus === 'unsubscribe' || !cpsSubscriptionHasAcceptedReceipts(subscriber)))
  ) {
    // A legacy active row with not_required/missing receipts is not proof of
    // delivery. This fresh explicit signup starts one new consent epoch and
    // must obtain both provider receipts before it becomes active again.
    const previousState = subscriber.subscription_state;
    const consentEpoch = randomUUID();
    const unsubscribeTokenExpiresAt =
      Math.floor(Date.parse(now) / 1000) + 365 * 24 * 60 * 60;
    const { data, error } = await sb
      .from('federation_newsletter_subscribers')
      .update({
        first_name: firstName ?? subscriber.first_name,
        source: CPS_SOURCE,
        unsubscribed: true,
        unsubscribed_at: null,
        subscription_state: 'pending',
        consent_epoch: consentEpoch,
        last_subscribed_at: now,
        unsubscribe_token_expires_at: unsubscribeTokenExpiresAt,
        welcome_status: 'pending',
        welcome_idempotency_key: `cps-welcome/${subscriber.id}/${consentEpoch}`,
        welcome_message_id: null,
        welcome_last_attempt_at: null,
        welcome_accepted_at: null,
        welcome_error_code: null,
        owner_status: 'pending',
        owner_idempotency_key: `cps-newsletter-owner/${subscriber.id}/${consentEpoch}`,
        owner_message_id: null,
        owner_last_attempt_at: null,
        owner_accepted_at: null,
        owner_error_code: null,
      })
      .eq('id', subscriber.id)
      .eq('consent_epoch', subscriber.consent_epoch)
      .eq('subscription_state', previousState)
      .select(CPS_SUBSCRIBER_FIELDS)
      .maybeSingle();
    if (error) {
      return cpsError(
        'Subscriptions are temporarily unavailable.',
        503,
        'subscriber_reactivation_failed',
      );
    }
    if (data) {
      subscriber = data as CpsSubscriber;
      action = 'reactivated';
    } else {
      const winner = await loadCpsSubscriber(sb, email);
      if (winner.error || !winner.row) {
        return cpsError(
          'Subscriptions are temporarily unavailable.',
          503,
          'subscriber_race_unresolved',
        );
      }
      subscriber = winner.row;
      action = subscriber.subscription_state === 'active' ? 'existing' : 'pending';
    }
  } else {
    action =
      subscriber.subscription_state === 'active'
        ? 'existing'
        : suppressionStatus === 'unsubscribe'
          ? 'reactivated'
          : 'pending';
    const updates: Record<string, string> = {
      source: CPS_SOURCE,
      last_subscribed_at: now,
    };
    if (firstName && !subscriber.owner_last_attempt_at) {
      updates.first_name = firstName;
    }
    const { data, error } = await sb
      .from('federation_newsletter_subscribers')
      .update(updates)
      .eq('id', subscriber.id)
      .eq('consent_epoch', subscriber.consent_epoch)
      .eq('subscription_state', subscriber.subscription_state)
      .select(CPS_SUBSCRIBER_FIELDS)
      .single();
    if (error || !data) {
      return cpsError(
        'Subscriptions are temporarily unavailable.',
        503,
        'subscriber_write_failed',
      );
    }
    subscriber = data as CpsSubscriber;
  }

  if (!subscriber) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'subscriber_state_missing',
    );
  }

  if (subscriber.subscription_state === 'active') {
    if (!cpsSubscriptionIsComplete(subscriber)) {
      return cpsError('Subscription acceptance could not be confirmed. Please try again.', 503, 'subscription_receipts_missing');
    }
    return withCors(
      NextResponse.json({
        ok: true,
        subscription_active: true,
        welcome_accepted: true,
        owner_notification_accepted: true,
        completion: 'already_subscribed' satisfies CpsCompletion,
      }),
    );
  }

  if (!Number.isSafeInteger(subscriber.unsubscribe_token_expires_at)) {
    return cpsError(
      'Subscriptions are temporarily unavailable.',
      503,
      'unsubscribe_token_state_missing',
    );
  }

  if (
    subscriber.welcome_status !== 'accepted' &&
    subscriber.welcome_last_attempt_at &&
    Date.now() - Date.parse(subscriber.welcome_last_attempt_at) >
      23 * 60 * 60 * 1000
  ) {
    return cpsError(
      'Your subscription needs a manual delivery check. Please contact CPS.',
      503,
      'welcome_reconciliation_required',
    );
  }

  if (subscriber.welcome_status === 'sending') {
    return cpsError(
      'Your welcome email is still being confirmed. Please try again shortly.',
      503,
      'welcome_delivery_in_progress',
    );
  }

  if (subscriber.welcome_status !== 'accepted') {
    if (!subscriber.welcome_idempotency_key) {
      const key = `cps-welcome/${subscriber.id}/${subscriber.consent_epoch}`;
      const keyPersisted = await persistCpsSubscriberState(
        sb,
        subscriber.id,
        subscriber.consent_epoch,
        { welcome_idempotency_key: key },
        'pending',
      );
      if (!keyPersisted) {
        return cpsError(
          'We could not confirm your email subscription. Please try again.',
          503,
          'welcome_state_persist_failed',
        );
      }
      subscriber.welcome_idempotency_key = key;
    }

    const attemptedAt = new Date().toISOString();
    const previousWelcomeStatus = subscriber.welcome_status;
    const previousWelcomeLastAttemptAt = subscriber.welcome_last_attempt_at;
    const attemptStatePersisted = await persistCpsSubscriberState(
      sb,
      subscriber.id,
      subscriber.consent_epoch,
      {
        welcome_status: 'sending',
        welcome_last_attempt_at: attemptedAt,
        welcome_error_code: null,
      },
      'pending',
      { column: 'welcome_status', status: previousWelcomeStatus },
    );
    if (!attemptStatePersisted) {
      return cpsError(
        'We could not confirm your email subscription. Please try again.',
        503,
        'welcome_state_persist_failed',
      );
    }
    subscriber.welcome_status = 'sending';
    subscriber.welcome_last_attempt_at = attemptedAt;

    const websiteUrl = brief.websiteUrl || `https://${brief.domain}`;
    // This is the final I/O before the provider call. The delivery state CAS
    // happens first, then the database authorizer rechecks the current consent
    // epoch and all CPS/global suppressions. There is deliberately no database
    // hop between this authorization and Resend.
    const authorizationFailure = await authorizeCpsDelivery(sb, subscriber);
    if (authorizationFailure) {
      await persistCpsSubscriberState(
        sb,
        subscriber.id,
        subscriber.consent_epoch,
        {
          welcome_status: previousWelcomeStatus,
          welcome_last_attempt_at: previousWelcomeLastAttemptAt,
          welcome_error_code: 'welcome_authorization_failed',
        },
        'pending',
        { column: 'welcome_status', status: 'sending' },
      );
      return authorizationFailure;
    }
    const welcome = await sendCpsWelcome(
      subscriber,
      brief.brandName,
      websiteUrl,
      brief.fromEmail,
      ownerRecipient,
    );
    if (!welcome.ok) {
      const failureStatePersisted = await persistCpsSubscriberState(
        sb,
        subscriber.id,
        subscriber.consent_epoch,
        {
          welcome_status: welcome.deliveryUnknown ? 'unknown' : 'failed',
          welcome_error_code: welcome.code.slice(0, 120),
        },
        'pending',
        { column: 'welcome_status', status: 'sending' },
      );
      if (!failureStatePersisted) {
        return cpsError(
          'We could not confirm your email subscription. Please try again.',
          503,
          'welcome_failure_state_persist_failed',
        );
      }
      return cpsError(
        'We could not confirm your welcome email. Please try again.',
        welcome.retryable ? 503 : 502,
        welcome.code,
      );
    }

    const acceptedAt = new Date().toISOString();
    const accepted = await persistCpsSubscriberState(
      sb,
      subscriber.id,
      subscriber.consent_epoch,
      {
        welcome_status: 'accepted',
        welcome_message_id: welcome.messageId,
        welcome_accepted_at: acceptedAt,
        welcome_error_code: null,
      },
      'pending',
      { column: 'welcome_status', status: 'sending' },
    );
    if (!accepted) {
      const winner = await loadCpsSubscriber(sb, email);
      if (
        !winner.error &&
        winner.row?.consent_epoch === subscriber.consent_epoch &&
        winner.row.welcome_status === 'accepted'
      ) {
        subscriber = winner.row;
      } else if (!winner.error && cpsSubscriptionIsComplete(winner.row)) {
        return withCors(
          NextResponse.json({
            ok: true,
            subscription_active: true,
            welcome_accepted: true,
            owner_notification_accepted: true,
            completion: 'already_subscribed' satisfies CpsCompletion,
          }),
        );
      } else {
        await persistCpsSubscriberState(
          sb,
          subscriber.id,
          subscriber.consent_epoch,
          cpsWelcomeAcceptanceUnknownState(welcome.messageId),
          'pending',
          { column: 'welcome_status', status: 'sending' },
        );
        return cpsError(
          'We could not confirm your email subscription. Please try again.',
          503,
          'welcome_acceptance_persist_failed',
        );
      }
    } else {
      subscriber.welcome_status = 'accepted';
      subscriber.welcome_message_id = welcome.messageId;
      subscriber.welcome_accepted_at = acceptedAt;
    }
  }

  if (
    subscriber.owner_status !== 'accepted' &&
    subscriber.owner_last_attempt_at &&
    Date.now() - Date.parse(subscriber.owner_last_attempt_at) >
      23 * 60 * 60 * 1000
  ) {
    return cpsError(
      'Your subscription needs a manual notification check. Please contact CPS.',
      503,
      'owner_reconciliation_required',
    );
  }

  if (subscriber.owner_status === 'sending') {
    return cpsError(
      'The CPS notification is still being confirmed. Please try again shortly.',
      503,
      'owner_delivery_in_progress',
    );
  }

  if (subscriber.owner_status !== 'accepted') {
    if (!subscriber.owner_idempotency_key) {
      const key =
        `cps-newsletter-owner/${subscriber.id}/${subscriber.consent_epoch}`;
      const keyPersisted = await persistCpsSubscriberState(
        sb,
        subscriber.id,
        subscriber.consent_epoch,
        { owner_idempotency_key: key },
        'pending',
      );
      if (!keyPersisted) {
        return cpsError(
          'We could not confirm your email subscription. Please try again.',
          503,
          'owner_state_persist_failed',
        );
      }
      subscriber.owner_idempotency_key = key;
    }

    const attemptedAt = new Date().toISOString();
    const previousOwnerStatus = subscriber.owner_status;
    const previousOwnerLastAttemptAt = subscriber.owner_last_attempt_at;
    const attemptStatePersisted = await persistCpsSubscriberState(
      sb,
      subscriber.id,
      subscriber.consent_epoch,
      {
        owner_status: 'sending',
        owner_last_attempt_at: attemptedAt,
        owner_error_code: null,
      },
      'pending',
      { column: 'owner_status', status: previousOwnerStatus },
    );
    if (!attemptStatePersisted) {
      return cpsError(
        'We could not confirm your email subscription. Please try again.',
        503,
        'owner_state_persist_failed',
      );
    }
    subscriber.owner_status = 'sending';
    subscriber.owner_last_attempt_at = attemptedAt;

    // Keep this as the final I/O before the owner provider call for the same
    // current-epoch, fail-closed suppression guarantee as the welcome email.
    const authorizationFailure = await authorizeCpsDelivery(sb, subscriber);
    if (authorizationFailure) {
      await persistCpsSubscriberState(
        sb,
        subscriber.id,
        subscriber.consent_epoch,
        {
          owner_status: previousOwnerStatus,
          owner_last_attempt_at: previousOwnerLastAttemptAt,
          owner_error_code: 'owner_authorization_failed',
        },
        'pending',
        { column: 'owner_status', status: 'sending' },
      );
      return authorizationFailure;
    }
    const owner = await sendCpsOwnerNotification(
      subscriber,
      ownerRecipient,
      brief.fromEmail,
    );
    if (!owner.ok) {
      const failureStatePersisted = await persistCpsSubscriberState(
        sb,
        subscriber.id,
        subscriber.consent_epoch,
        {
          owner_status: owner.deliveryUnknown ? 'unknown' : 'failed',
          owner_error_code: owner.code.slice(0, 120),
        },
        'pending',
        { column: 'owner_status', status: 'sending' },
      );
      if (!failureStatePersisted) {
        return cpsError(
          'We could not confirm your email subscription. Please try again.',
          503,
          'owner_failure_state_persist_failed',
        );
      }
      return cpsError(
        'We could not notify the CPS team. Please try again.',
        owner.retryable ? 503 : 502,
        owner.code,
      );
    }

    const acceptedAt = new Date().toISOString();
    const accepted = await persistCpsSubscriberState(
      sb,
      subscriber.id,
      subscriber.consent_epoch,
      {
        owner_status: 'accepted',
        owner_message_id: owner.messageId,
        owner_accepted_at: acceptedAt,
        owner_error_code: null,
      },
      'pending',
      { column: 'owner_status', status: 'sending' },
    );
    if (!accepted) {
      const winner = await loadCpsSubscriber(sb, email);
      if (
        !winner.error &&
        winner.row?.consent_epoch === subscriber.consent_epoch &&
        winner.row.owner_status === 'accepted'
      ) {
        subscriber = winner.row;
      } else if (!winner.error && cpsSubscriptionIsComplete(winner.row)) {
        return withCors(
          NextResponse.json({
            ok: true,
            subscription_active: true,
            welcome_accepted: true,
            owner_notification_accepted: true,
            completion: 'already_subscribed' satisfies CpsCompletion,
          }),
        );
      } else {
        await persistCpsSubscriberState(
          sb,
          subscriber.id,
          subscriber.consent_epoch,
          cpsOwnerAcceptanceUnknownState(owner.messageId),
          'pending',
          { column: 'owner_status', status: 'sending' },
        );
        return cpsError(
          'We could not confirm your email subscription. Please try again.',
          503,
          'owner_acceptance_persist_failed',
        );
      }
    } else {
      subscriber.owner_status = 'accepted';
      subscriber.owner_message_id = owner.messageId;
      subscriber.owner_accepted_at = acceptedAt;
    }
  }

  const { data: finalized, error: finalizationError } = await sb.rpc(
    'finalize_cps_newsletter_subscription',
    {
      p_subscriber_id: subscriber.id,
      p_consent_epoch: subscriber.consent_epoch,
    },
  );
  if (finalizationError || finalized !== true) {
    const winner = await loadCpsSubscriber(sb, email);
    if (
      !winner.error &&
      winner.row?.consent_epoch === subscriber.consent_epoch &&
      cpsSubscriptionIsComplete(winner.row)
    ) {
      return withCors(
        NextResponse.json({
          ok: true,
          subscription_active: true,
          welcome_accepted: true,
          owner_notification_accepted: true,
          completion: 'already_subscribed' satisfies CpsCompletion,
        }),
      );
    }
    return cpsError(
      'We could not confirm your email subscription. Please try again.',
      503,
      'subscription_finalization_failed',
    );
  }

  const completion: CpsCompletion =
    action === 'reactivated'
      ? 'reactivated_welcome_accepted'
      : 'new_welcome_accepted';
  return withCors(
    NextResponse.json({
      ok: true,
      subscription_active: true,
      welcome_accepted: true,
      owner_notification_accepted: true,
      completion,
    }),
  );
}


export async function handleCpsNewsletterPost(request: Request): Promise<NextResponse> {
  noStore();
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return cpsError('JSON is required.', 415, 'unsupported_media_type');
  }
  const declaredBytes = Number(request.headers.get('content-length') || '0');
  if (declaredBytes > 32 * 1024) return cpsError('Request is too large.', 413, 'payload_too_large');
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 32 * 1024) return cpsError('Request is too large.', 413, 'payload_too_large');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return cpsError('Invalid request.', 400, 'invalid_request');
    body = parsed as Record<string, unknown>;
  } catch {
    return cpsError('Invalid JSON.', 400, 'invalid_json');
  }
  if (body.site !== undefined && body.site !== CPS_SITE) return cpsError('Invalid site.', 400, 'invalid_site');
  return handleCpsSubscription(request, body);
}

