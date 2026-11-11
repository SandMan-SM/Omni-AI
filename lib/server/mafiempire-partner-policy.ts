import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { verifyVercelProjectToken } from '@/lib/server/vercel-oidc';

export const MAFI_SOURCE = 'mafiempire_partner_application';
export const MAFI_PAGE = 'https://mafiempire.com/partner';
export const MAFI_CONSULTATION_PAGE = 'https://mafiempire.com/consultation';
export const MAFI_META = 'mafiempire_partner_v1';
export const MAFI_BUSINESS = '733b8da0-f8e6-4d50-8676-ccc4b0d2f5f6';
export const MAFI_OWNER = 'sitanim8@gmail.com';
export const MAFI_OWNER_FROM = 'New Lead Mafi Empire <notifications@mafiempire.com>';
export const MAFI_CUSTOMER_FROM = 'Mafi Empire <legacy@mafiempire.com>';
export const MAFI_REPLY_TO = 'hello@mafiempire.com';
export const MAFI_PATH = '/api/inbound/mafiempire/partners';
export const MAFI_CONSULTATION_SERVICE = 'free-30-minute-consultation';
export const MAFI_CONSULTATION_SERVICES = [
  MAFI_CONSULTATION_SERVICE,
  'content-studio',
  'website-development',
  'traditional-marketing',
  'agentic-marketing',
  'ai-employees',
  'personal-branding',
  'legacy-branding',
  'business-branding',
] as const;
export type MafiConsultationService = (typeof MAFI_CONSULTATION_SERVICES)[number];
const MAFI_SERVICE_LABELS: Record<MafiConsultationService, string> = {
  'free-30-minute-consultation': 'Free 30-minute',
  'content-studio': 'Content Studio',
  'website-development': 'Website Development',
  'traditional-marketing': 'Traditional Marketing',
  'agentic-marketing': 'Agentic Marketing',
  'ai-employees': 'AI Employees',
  'personal-branding': 'Personal Branding',
  'legacy-branding': 'Legacy Branding',
  'business-branding': 'Business Branding',
};
export function mafiConsultationLabel(service: MafiConsultationService): string { return MAFI_SERVICE_LABELS[service]; }

export type PartnerConsultationRequest = {
  service: MafiConsultationService;
  preferredDate: string; preferredTime: string; timeZone: string;
};
export type PartnerConsultation = PartnerConsultationRequest & {
  durationMinutes: 30; status: 'pending_confirmation'; requestedStartAt: string; canonicalTimeZone: string;
};

export class MafiPartnerError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly retryable = status >= 500) { super(code); }
}

export type PartnerInput = {
  name: string; email: string; phone: string; message: string;
  submissionId: string; source: typeof MAFI_SOURCE; pageUrl: typeof MAFI_PAGE | typeof MAFI_CONSULTATION_PAGE; honeypot: string;
  consultation?: PartnerConsultationRequest;
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
  pageUrl: typeof MAFI_PAGE | typeof MAFI_CONSULTATION_PAGE; fingerprint: string;
  status: 'pending' | 'failed' | 'complete';
  customer: PartnerMessage; owner: PartnerMessage;
  lease: string; leaseUntil: string; createdAt: string; updatedAt: string;
  error?: string; retryable?: boolean; signature?: string;
  consultation?: PartnerConsultation;
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
    state.pageUrl === input.pageUrl && state.submissionId === input.submissionId && state.leadId === input.submissionId &&
    state.fingerprint === partnerFingerprint(input) && typeof state.signature === 'string' &&
    /^[a-f0-9]{64}$/.test(state.signature) && equal(state.signature, signPartnerState(state, secret)));
}
export function partnerFingerprint(input: PartnerInput): string {
  return createHash('sha256').update('mafiempire-partner-request-v1\0').update(canonical({
    name: input.name, email: input.email, phone: input.phone, message: input.message,
    submissionId: input.submissionId, source: input.source, pageUrl: input.pageUrl,
    // Preserve the exact legacy hash when the structured request is absent.
    // Derived UTC is excluded: retries bind the original wall time even if tzdata changes.
    ...(input.consultation ? { consultation: {
      service: input.consultation.service, preferredDate: input.consultation.preferredDate,
      preferredTime: input.consultation.preferredTime, timeZone: input.consultation.timeZone,
    } } : {}),
  })).digest('hex');
}
function required(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new MafiPartnerError(code, 422, false);
  return value.trim();
}
function optionalNotes(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.trim().length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new MafiPartnerError('invalid_notes', 422, false);
  return value.trim();
}

/** Parse stable submitted fields; moving scheduling checks belong to the new-UUID path. */
export function parsePartnerConsultation(b: Record<string, unknown>): PartnerConsultationRequest | undefined {
  const fields = ['service', 'preferred_date', 'preferred_time', 'time_zone'];
  if (fields.every(key => b[key] === undefined)) return undefined;
  if (fields.some(key => typeof b[key] !== 'string' || !String(b[key]).trim())) throw new MafiPartnerError('consultation_fields_required', 422, false);
  if (!MAFI_CONSULTATION_SERVICES.includes(b.service as MafiConsultationService)) throw new MafiPartnerError('invalid_consultation_service', 422, false);
  const preferredDate = required(b.preferred_date, 10, 'invalid_preferred_date');
  const preferredTime = required(b.preferred_time, 5, 'invalid_preferred_time');
  const requestedZone = required(b.time_zone, 100, 'invalid_time_zone');
  if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(preferredDate)) throw new MafiPartnerError('invalid_preferred_date', 422, false);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) throw new MafiPartnerError('invalid_preferred_time', 422, false);
  // Intl also accepts numeric offset zones in newer runtimes; require a named identifier.
  if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(requestedZone)) throw new MafiPartnerError('invalid_time_zone', 422, false);
  const [year, month, day] = preferredDate.split('-').map(Number);
  const [hour, minute] = preferredTime.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(wall).toISOString().slice(0, 10) !== preferredDate) throw new MafiPartnerError('invalid_preferred_date', 422, false);
  try { new Intl.DateTimeFormat('en', { timeZone: requestedZone }); }
  catch { throw new MafiPartnerError('invalid_time_zone', 422, false); }
  return { service: b.service as MafiConsultationService, preferredDate, preferredTime, timeZone: requestedZone };
}

/** Called only for a new intent: an existing signed replay retains its stored instant. */
export function resolvePartnerConsultation(request: PartnerConsultationRequest): PartnerConsultation {
  const { preferredDate, preferredTime, timeZone } = request;
  const [year, month, day] = preferredDate.split('-').map(Number);
  const [hour, minute] = preferredTime.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', { timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const wallAt = (instant: number): number => {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
    return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
  };
  const offsets = new Set<number>();
  // Sampling either side captures non-hour DST changes and date-line transitions too.
  for (let h = -36; h <= 36; h++) {
    const sample = wall + h * 3_600_000;
    offsets.add(wallAt(sample) - sample);
  }
  const candidates = Array.from(offsets).map(offset => wall - offset).filter(instant => wallAt(instant) === wall);
  if (candidates.length !== 1) throw new MafiPartnerError(candidates.length ? 'ambiguous_preferred_time' : 'nonexistent_preferred_time', 422, false);
  return { ...request, canonicalTimeZone: formatter.resolvedOptions().timeZone,
    durationMinutes: 30, status: 'pending_confirmation', requestedStartAt: new Date(candidates[0]).toISOString() };
}

/** Enforce time bounds only for a NEW UUID; persisted exact retries must remain replayable. */
export function validateNewPartnerConsultation(input: PartnerInput, now = new Date()): void {
  if (!input.consultation) return;
  const start = Date.parse(resolvePartnerConsultation(input.consultation).requestedStartAt);
  if (start < now.getTime() + 15 * 60_000 || start > now.getTime() + 180 * 86_400_000) throw new MafiPartnerError('preferred_time_out_of_range', 422, false);
}

export function partnerConsultationSummary(consultation: PartnerConsultationRequest): string {
  return `${mafiConsultationLabel(consultation.service)} consultation\nPreferred date: ${consultation.preferredDate}\nPreferred time: ${consultation.preferredTime}\nTime zone: ${consultation.timeZone}\nDuration: 30 minutes\nStatus: Pending confirmation. This is a preferred time request, not a confirmed booking.`;
}
export function parsePartnerInput(body: unknown): PartnerInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MafiPartnerError('invalid_body', 422, false);
  const b = body as Record<string, unknown>;
  const name = required(b.name, 200, 'name_required');
  const email = required(b.email, 254, 'invalid_email').toLowerCase();
  const phone = required(b.phone, 50, 'invalid_phone');
  const consultation = parsePartnerConsultation(b);
  const message = consultation ? optionalNotes(b.message) : required(b.message, 4000, 'message_required');
  const submissionId = required(b.submission_id, 36, 'invalid_submission_id').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MafiPartnerError('invalid_email', 422, false);
  if (!/^[+()\-\s.\d]{7,50}$/.test(phone) || phone.replace(/\D/g, '').length < 7) throw new MafiPartnerError('invalid_phone', 422, false);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(submissionId)) throw new MafiPartnerError('invalid_submission_id', 422, false);
  if (b.source !== MAFI_SOURCE || (b.page_url !== MAFI_PAGE && b.page_url !== MAFI_CONSULTATION_PAGE)) throw new MafiPartnerError('invalid_source_context', 422, false);
  const pageUrl = b.page_url as typeof MAFI_PAGE | typeof MAFI_CONSULTATION_PAGE;
  if (consultation && pageUrl !== MAFI_CONSULTATION_PAGE && consultation.service !== MAFI_CONSULTATION_SERVICE) throw new MafiPartnerError('invalid_source_context', 422, false);
  return { name, email, phone, message, submissionId, source: MAFI_SOURCE, pageUrl,
    honeypot: typeof b.company_website === 'string' ? b.company_website.slice(0, 500).trim() : '',
    ...(consultation ? { consultation } : {}) };
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
  const consultation = input.consultation ? resolvePartnerConsultation(input.consultation) : undefined;
  const summary = consultation ? partnerConsultationSummary(consultation) : '';
  const customerText = consultation
    ? `Hi ${input.name},\n\nWe received your request for a free 30-minute Mafi Empire consultation. Sitani will follow up to confirm the time and meeting details. Your preferred time is not booked yet.\n\n${summary}\n\nYour notes:\n${input.message || 'No additional notes.'}\n\nReference: ${input.submissionId}\nMafi Empire · Building foundations for generations\nhttps://mafiempire.com`
    : `Hi ${input.name},\n\nWe received your Mafi Empire partner application. Sitani will review what you would like to build for your family and follow up with you.\n\nYour application:\n${input.message}\n\nReference: ${input.submissionId}\nMafi Empire · Building foundations for generations\nhttps://mafiempire.com`;
  const ownerText = consultation
    ? `New Mafi Empire consultation request\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\n\n${summary}\n\nNotes: ${input.message || 'No additional notes.'}\nPage: ${input.pageUrl}\nReference: ${input.submissionId}\nDashboard: https://mythosais.com/dashboard`
    : `New Mafi Empire partner application\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\nWhat they want to build: ${input.message}\nPage: ${input.pageUrl}\nReference: ${input.submissionId}\nDashboard: https://mythosais.com/dashboard`;
  const html = (text: string) => `<html lang="en"><body style="margin:0;background:#f3efe3;color:#14231c;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px;line-height:1.6;white-space:pre-wrap">${escape(text)}</div></body></html>`;
  return {
    version: 1, purpose: MAFI_SOURCE, submissionId: input.submissionId, leadId: input.submissionId, crmId, analyticsId,
    businessId: MAFI_BUSINESS, tenant: 'mafiempire', source: MAFI_SOURCE, pageUrl: input.pageUrl, fingerprint: partnerFingerprint(input),
    status: 'pending', lease, leaseUntil: new Date(now.getTime() + 75_000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    ...(consultation ? { consultation: { ...consultation } } : {}),
    customer: { status: 'pending', key: `${key}-customer`, payload: { from: MAFI_CUSTOMER_FROM, to: [input.email], reply_to: MAFI_REPLY_TO,
      subject: consultation ? 'Your consultation request — Mafi Empire' : 'We received your application — Mafi Empire', text: customerText, html: html(customerText) } },
    owner: { status: 'pending', key: `${key}-owner`, payload: { from: MAFI_OWNER_FROM, to: [MAFI_OWNER], reply_to: input.email,
      subject: consultation ? 'New Mafi Empire consultation request' : 'New Mafi Empire partner application', text: ownerText, html: html(ownerText) } },
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
