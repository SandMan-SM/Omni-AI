import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { verifyVercelProjectToken } from '@/lib/server/vercel-oidc';

export const IMPERIUM_BUSINESS = '18a15b57-11e2-4bed-bfd6-5694b344658a';
export const IMPERIUM_SOURCE = 'imperium';
export const SUCCESS_EMPIRE_OFFER = 'success_empire';
export const IMPERIUM_PURPOSE = 'imperium_success_empire_application';
export const IMPERIUM_META = 'imperium_success_empire_v1';
export const IMPERIUM_PAGE = 'https://secretimperium.com/apply/';
export const IMPERIUM_PATH = '/api/inbound/imperium/success-empire';
// Owner sender matches federation.lead_senders; customer sender is the existing Imperium identity.
export const IMPERIUM_OWNER_FROM = 'New Lead Imperium <imperium@leadfranchise.org>';
export const IMPERIUM_CUSTOMER_FROM = 'Imperium <newsletter@secretimperium.com>';

export class ImperiumApplicationError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly retryable = status >= 500) {
    super(code);
  }
}
export type ApplicationInput = {
  fullName: string; email: string; phone: string; message: string; submissionId: string;
  source: typeof IMPERIUM_SOURCE; offer: typeof SUCCESS_EMPIRE_OFFER;
  pageUrl: typeof IMPERIUM_PAGE; honeypot: string;
};
export type SuppressionStatus = 'clear' | 'suppressed';
export type ApplicationMessage = {
  status: 'pending' | 'sending' | 'accepted' | 'failed' | 'suppressed';
  key: string; firstAttemptAt?: string; providerId?: string; error?: string; suppressedAt?: string;
  payload: { from: string; to: string[]; reply_to: string; subject: string; text: string; html: string };
};
export type ApplicationState = {
  version: 1; purpose: typeof IMPERIUM_PURPOSE;
  submissionId: string; leadId: string; crmId: string; analyticsId: string;
  businessId: typeof IMPERIUM_BUSINESS; tenant: 'imperium'; source: typeof IMPERIUM_SOURCE;
  offer: typeof SUCCESS_EMPIRE_OFFER; pageUrl: typeof IMPERIUM_PAGE; marketingConsent: false;
  fingerprint: string; status: 'pending' | 'failed' | 'complete';
  customer: ApplicationMessage; owner: ApplicationMessage;
  lease: string; leaseUntil: string; createdAt: string; updatedAt: string;
  error?: string; retryable?: boolean; signature?: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter(key => row[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
function equal(left: string, right: string): boolean {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function applicationFingerprint(input: ApplicationInput): string {
  return createHash('sha256').update('imperium-success-empire-request-v1\0').update(canonical({
    fullName: input.fullName, email: input.email, phone: input.phone, message: input.message,
    submissionId: input.submissionId, source: IMPERIUM_SOURCE, offer: SUCCESS_EMPIRE_OFFER, pageUrl: IMPERIUM_PAGE,
  })).digest('hex');
}
export function signApplicationState(state: ApplicationState, secret: string): string {
  if (!secret) throw new ImperiumApplicationError('signing_not_configured');
  const unsigned = { ...state }; delete unsigned.signature;
  return createHmac('sha256', secret).update('imperium-success-empire-state-v1\0').update(canonical(unsigned)).digest('hex');
}
export function trustedApplicationState(state: ApplicationState, secret: string, input: ApplicationInput): boolean {
  return Boolean(state && state.version === 1 && state.purpose === IMPERIUM_PURPOSE &&
    state.businessId === IMPERIUM_BUSINESS && state.tenant === 'imperium' && state.source === IMPERIUM_SOURCE &&
    state.offer === SUCCESS_EMPIRE_OFFER && state.marketingConsent === false && state.pageUrl === IMPERIUM_PAGE &&
    state.submissionId === input.submissionId && state.leadId === input.submissionId &&
    state.fingerprint === applicationFingerprint(input) && typeof state.signature === 'string' &&
    /^[a-f0-9]{64}$/.test(state.signature) && equal(state.signature, signApplicationState(state, secret)));
}
function required(value: unknown, max: number, code: string, multiline = false): string {
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || controls.test(value)) {
    throw new ImperiumApplicationError(code, 422, false);
  }
  return value.trim();
}
export function parseApplicationInput(value: unknown): ApplicationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ImperiumApplicationError('invalid_body', 422, false);
  const body = value as Record<string, unknown>;
  const fullName = required(body.fullName, 200, 'name_required');
  const email = required(body.email, 254, 'invalid_email').toLowerCase();
  const phoneInput = required(body.phone, 50, 'invalid_phone');
  const message = required(body.message, 4000, 'message_required', true);
  const submissionId = required(body.submission_id, 36, 'invalid_submission_id').toLowerCase();
  if (!/^[^\s@<>"(),:;\\]+@[^\s@<>"(),:;\\]+\.[^\s@<>"(),:;\\]+$/.test(email)) throw new ImperiumApplicationError('invalid_email', 422, false);
  const phone = phoneInput.replace(/[()\s.\-]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) throw new ImperiumApplicationError('invalid_phone', 422, false);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(submissionId)) {
    throw new ImperiumApplicationError('invalid_submission_id', 422, false);
  }
  // Provenance is receiver-owned. Optional proxy assertions can only agree with these constants.
  if ((body.source !== undefined && body.source !== IMPERIUM_SOURCE) ||
      (body.offer !== undefined && body.offer !== SUCCESS_EMPIRE_OFFER) ||
      (body.page_url !== undefined && body.page_url !== IMPERIUM_PAGE)) {
    throw new ImperiumApplicationError('invalid_source_context', 422, false);
  }
  return { fullName, email, phone, message, submissionId, source: IMPERIUM_SOURCE,
    offer: SUCCESS_EMPIRE_OFFER, pageUrl: IMPERIUM_PAGE,
    honeypot: typeof body.company_website === 'string' ? body.company_website.trim().slice(0, 500) : '' };
}
export function applicationOwnerEmail(value = process.env.IMPERIUM_SUCCESS_EMPIRE_OWNER_EMAIL): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\u0000-\u001f\u007f]/.test(email)) {
    throw new ImperiumApplicationError('owner_not_configured');
  }
  return email;
}

export function isImperiumLocalRequest(request: Request, env: NodeJS.ProcessEnv): boolean {
  const secret = env.IMPERIUM_SUCCESS_EMPIRE_LOCAL_INTAKE_SECRET || '';
  const supplied = request.headers.get('x-imperium-success-empire-local-intake') || '';
  const url = new URL(request.url);
  return env.NODE_ENV === 'development' && !env.VERCEL && env.IMPERIUM_SUCCESS_EMPIRE_LOCAL_INTAKE_ENABLED === '1' &&
    // Next14 normalizes 127.0.0.1 to localhost in NextRequest.url.
    secret.length >= 24 && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) &&
    url.port === '3002' && url.pathname === IMPERIUM_PATH && !url.username && !url.password && !url.search && !url.hash && equal(secret, supplied);
}
export async function authenticateImperiumApplication(request: Request): Promise<boolean> {
  if (isImperiumLocalRequest(request, process.env)) return true;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(token) && verifyVercelProjectToken(token, {
    ownerId: 'team_jvhwfBn81nJXTMX0DEvwQCuA',
    projectId: 'prj_rbnO8QZmuJtlDpWlGYE1tcYkwx3o', projectName: 'imperium', environment: 'production',
  });
}
function escape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}
export function buildApplicationState(input: ApplicationInput, crmId: string, analyticsId: string,
  lease: string, ownerEmail: string, now = new Date()): ApplicationState {
  const owner = applicationOwnerEmail(ownerEmail);
  const key = `imperium-success-empire-v1-${input.submissionId}`;
  const customerText = `Hi ${input.fullName},\n\nWe received your application to join Success Empire through Imperium. Your application will be reviewed, and we will follow up using the contact details you provided.\n\nWhat you would like to build or change:\n${input.message}\n\nReference: ${input.submissionId}\n\nThis confirms receipt of your application, not acceptance into Success Empire. You have not been subscribed to marketing emails.\nImperium\n${IMPERIUM_PAGE}`;
  const ownerText = `New Success Empire application — Imperium\nName: ${input.fullName}\nEmail: ${input.email}\nPhone: ${input.phone}\nWhat they would like to build or change: ${input.message}\nSource: Imperium\nOffer: Success Empire\nMarketing consent: not requested or granted\nPage: ${IMPERIUM_PAGE}\nReference: ${input.submissionId}\nDashboard: https://mythosais.com/dashboard`;
  const html = (text: string) => `<html lang="en"><body style="margin:0;background:#f3efe3;color:#252b27;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px;line-height:1.6;white-space:pre-wrap">${escape(text)}</div></body></html>`;
  return {
    version: 1, purpose: IMPERIUM_PURPOSE, submissionId: input.submissionId, leadId: input.submissionId,
    crmId, analyticsId, businessId: IMPERIUM_BUSINESS, tenant: 'imperium', source: IMPERIUM_SOURCE,
    offer: SUCCESS_EMPIRE_OFFER, pageUrl: IMPERIUM_PAGE, marketingConsent: false, fingerprint: applicationFingerprint(input),
    status: 'pending', lease, leaseUntil: new Date(now.getTime() + 75_000).toISOString(),
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
    customer: { status: 'pending', key: `${key}-customer`, payload: {
      from: IMPERIUM_CUSTOMER_FROM, to: [input.email], reply_to: owner,
      subject: 'We received your Success Empire application', text: customerText, html: html(customerText),
    } },
    owner: { status: 'pending', key: `${key}-owner`, payload: {
      from: IMPERIUM_OWNER_FROM, to: [owner], reply_to: input.email,
      subject: 'New Success Empire application — Imperium', text: ownerText, html: html(ownerText),
    } },
  };
}
export function applicationComplete(state: ApplicationState): boolean {
  const customerDone = (state.customer.status === 'accepted' && Boolean(state.customer.providerId)) ||
    (state.customer.status === 'suppressed' && Boolean(state.customer.suppressedAt) && !state.customer.providerId);
  return customerDone && state.owner.status === 'accepted' && Boolean(state.owner.providerId);
}

/** Immutable intent precedes sends; every accepted receipt precedes visible success. */
export async function deliverApplicationMessages(state: ApplicationState, deps: {
  checkSuppression: () => Promise<SuppressionStatus>; persist: () => Promise<void>;
  send: (message: ApplicationMessage) => Promise<string>; now?: () => Date;
}): Promise<void> {
  for (const channel of ['customer', 'owner'] as const) {
    const message = state[channel];
    if (message.status === 'accepted' && message.providerId) continue;
    if (channel === 'customer') {
      if (message.status === 'suppressed' && message.suppressedAt && !message.providerId) continue;
      if (await deps.checkSuppression() === 'suppressed') {
        message.status = 'suppressed'; message.suppressedAt = (deps.now || (() => new Date()))().toISOString();
        delete message.error; delete message.providerId;
        await deps.persist();
        continue;
      }
    }
    const now = (deps.now || (() => new Date()))();
    if (message.firstAttemptAt && now.getTime() - Date.parse(message.firstAttemptAt) >= 23 * 60 * 60 * 1000) {
      throw new ImperiumApplicationError(`${channel}_receipt_reconciliation_required`, 503, false);
    }
    message.firstAttemptAt ||= now.toISOString(); message.status = 'sending'; delete message.error;
    await deps.persist();
    let providerId: string;
    try {
      providerId = await deps.send(message);
      if (!providerId) throw new ImperiumApplicationError(`${channel}_provider_receipt_missing`);
    } catch (error) {
      message.status = 'failed'; message.error = `${channel}_notification_failed`;
      await deps.persist();
      throw error instanceof ImperiumApplicationError ? error : new ImperiumApplicationError(message.error);
    }
    message.status = 'accepted'; message.providerId = providerId;
    // Receipt persistence failure must not relabel an accepted provider request as a rejection.
    await deps.persist();
  }
}
