import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { verifyVercelProjectToken } from '@/lib/server/vercel-oidc';

export const MAFI_SOURCE = 'mafiempire_partner_application';
export const MAFI_PAGE = 'https://mafiempire.com/partner';
export const MAFI_META = 'mafiempire_partner_v1';
export const MAFI_BUSINESS = '733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6';
export const MAFI_OWNER = 'sitanim8@gmail.com';
export const MAFI_OWNER_FROM = 'New Lead Mafi Empire <mafiempire@leadfranchise.org>';
export const MAFI_CUSTOMER_FROM = 'Mafi Empire <legacy@sitanimafi.com>';
export const MAFI_PATH = '/api/inbound/mafiempire/partners';

export class MafiPartnerError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly retryable = status >= 500) { super(code); }
}

export type PartnerInput = {
  name: string; email: string; phone: string; message: string;
  submissionId: string; source: typeof MAFI_SOURCE; pageUrl: typeof MAFI_PAGE; honeypot: string;
};
export type PartnerMessage = {
  status: 'pending' | 'sending' | 'accepted' | 'failed';
  key: string; firstAttemptAt?: string; providerId?: string; error?: string;
  payload: { from: string; to: string[]; reply_to: string; subject: string; text: string; html: string };
};
export type PartnerState = {
  version: 1; purpose: 'mafiempire_partner_application';
  submissionId: string; leadId: string; crmId: string; analyticsId: string;
  businessId: typeof MAFI_BUSINESS; tenant: 'mafiempire'; source: typeof MAFI_SOURCE;
  pageUrl: typeof MAFI_PAGE; fingerprint: string;
  status: 'pending' | 'failed' | 'complete';
  customer: PartnerMessage; owner: PartnerMessage;
  lease: string; leaseUntil: string; createdAt: string; updatedAt: string;
  error?: string; retryable?: boolean; signature?: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).filter(key => row[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
function equal(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signPartnerState(state: PartnerState, secret: string): string {
  if (!secret) throw new MafiPartnerError('signing_not_configured');
  const unsigned = { ...state }; delete unsigned.signature;
  return createHmac('sha256', secret).update('mafiempire-partner-state-v1\0').update(canonical(unsigned)).digest('hex');
}
export function trustedPartnerState(state: PartnerState, secret: string, input: PartnerInput): boolean {
  return Boolean(state && state.version === 1 && state.purpose === MAFI_SOURCE &&
    state.businessId === MAFI_BUSINESS && state.tenant === 'mafiempire' && state.source === MAFI_SOURCE &&
    state.pageUrl === MAFI_PAGE && state.submissionId === input.submissionId && state.leadId === input.submissionId &&
    state.fingerprint === partnerFingerprint(input) && typeof state.signature === 'string' &&
    /^[a-f0-9]{64}$/.test(state.signature) && equal(state.signature, signPartnerState(state, secret)));
}
export function partnerFingerprint(input: PartnerInput): string {
  return createHash('sha256').update('mafiempire-partner-request-v1\0').update(canonical({
    name: input.name, email: input.email, phone: input.phone, message: input.message,
    submissionId: input.submissionId, source: input.source, pageUrl: input.pageUrl,
  })).digest('hex');
}
function required(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new MafiPartnerError(code, 422, false);
  return value.trim();
}
export function parsePartnerInput(body: unknown): PartnerInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MafiPartnerError('invalid_body', 422, false);
  const b = body as Record<string, unknown>;
  const name = required(b.name, 200, 'name_required');
  const email = required(b.email, 254, 'invalid_email').toLowerCase();
  const phone = required(b.phone, 50, 'invalid_phone');
  const message = required(b.message, 4000, 'message_required');
  const submissionId = required(b.submission_id, 36, 'invalid_submission_id').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MafiPartnerError('invalid_email', 422, false);
  if (!/^[+()\-\s.\d]{7,50}$/.test(phone) || phone.replace(/\D/g, '').length < 7) throw new MafiPartnerError('invalid_phone', 422, false);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(submissionId)) throw new MafiPartnerError('invalid_submission_id', 422, false);
  if (b.source !== MAFI_SOURCE || b.page_url !== MAFI_PAGE) throw new MafiPartnerError('invalid_source_context', 422, false);
  return { name, email, phone, message, submissionId, source: MAFI_SOURCE, pageUrl: MAFI_PAGE,
    honeypot: typeof b.company_website === 'string' ? b.company_website.slice(0, 500).trim() : '' };
}

export function isMafiLocalRequest(request: Request, env: NodeJS.ProcessEnv): boolean {
  const secret = env.MAFIEMPIRE_LOCAL_INTAKE_SECRET || '';
  const supplied = request.headers.get('x-mafiempire-local-intake') || '';
  const url = new URL(request.url);
  return env.NODE_ENV === 'development' && !env.VERCEL && env.MAFIEMPIRE_LOCAL_INTAKE_ENABLED === '1' &&
    secret.length >= 24 && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.port === '3002' && url.pathname === MAFI_PATH && !url.username && !url.password && !url.search && !url.hash && equal(secret, supplied);
}
export async function authenticateMafiPartner(request: Request): Promise<boolean> {
  if (isMafiLocalRequest(request, process.env)) return true;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(token) && verifyVercelProjectToken(token, {
    ownerId: 'team_jvhwfBn81nJXTMX0DEvwQCuA',
    projectId: 'prj_5l48LlKx5AaR1l6xvFAPfgTU6P8t', projectName: 'mafiempire', environment: 'production',
  });
}

function escape(value: string): string { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!)); }
export function buildPartnerState(input: PartnerInput, crmId: string, analyticsId: string, lease: string, now = new Date()): PartnerState {
  const key = `mafiempire-partner-v1-${input.submissionId}`;
  const customerText = `Hi ${input.name},\n\nWe received your Mafi Empire partner application. Sitani will review what you would like to build for your family and follow up with you.\n\nYour application:\n${input.message}\n\nReference: ${input.submissionId}\nMafi Empire · Building foundations for generations\nhttps://mafiempire.com`;
  const ownerText = `New Mafi Empire partner application\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\nWhat they want to build: ${input.message}\nPage: ${MAFI_PAGE}\nReference: ${input.submissionId}\nDashboard: https://mythosais.com/dashboard`;
  const html = (text: string) => `<html lang="en"><body style="margin:0;background:#f3efe3;color:#14231c;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px;line-height:1.6;white-space:pre-wrap">${escape(text)}</div></body></html>`;
  return {
    version: 1, purpose: MAFI_SOURCE, submissionId: input.submissionId, leadId: input.submissionId, crmId, analyticsId,
    businessId: MAFI_BUSINESS, tenant: 'mafiempire', source: MAFI_SOURCE, pageUrl: MAFI_PAGE, fingerprint: partnerFingerprint(input),
    status: 'pending', lease, leaseUntil: new Date(now.getTime() + 75_000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    customer: { status: 'pending', key: `${key}-customer`, payload: { from: MAFI_CUSTOMER_FROM, to: [input.email], reply_to: MAFI_OWNER,
      subject: 'We received your application — Mafi Empire', text: customerText, html: html(customerText) } },
    owner: { status: 'pending', key: `${key}-owner`, payload: { from: MAFI_OWNER_FROM, to: [MAFI_OWNER], reply_to: input.email,
      subject: 'New Mafi Empire partner application', text: ownerText, html: html(ownerText) } },
  };
}

/** Both messages are required. Persist immutable intent before sending and acceptance before success. */
export async function deliverPartnerMessages(state: PartnerState, deps: {
  checkSuppression: () => Promise<void>; persist: () => Promise<void>;
  send: (message: PartnerMessage) => Promise<string>; now?: () => Date;
}): Promise<void> {
  for (const channel of ['customer', 'owner'] as const) {
    const message = state[channel];
    if (message.status === 'accepted' && message.providerId) continue;
    await deps.checkSuppression();
    const now = (deps.now || (() => new Date()))();
    if (message.firstAttemptAt && now.getTime() - Date.parse(message.firstAttemptAt) >= 23 * 60 * 60 * 1000) {
      throw new MafiPartnerError(`${channel}_receipt_reconciliation_required`, 503, false);
    }
    message.firstAttemptAt ||= now.toISOString(); message.status = 'sending'; delete message.error;
    await deps.persist();
    try {
      const id = await deps.send(message);
      if (!id) throw new MafiPartnerError(`${channel}_provider_receipt_missing`);
      message.status = 'accepted'; message.providerId = id;
      await deps.persist();
    } catch (error) {
      message.status = 'failed'; message.error = `${channel}_notification_failed`;
      await deps.persist();
      throw error instanceof MafiPartnerError ? error : new MafiPartnerError(message.error);
    }
  }
}
