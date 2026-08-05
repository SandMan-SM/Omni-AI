/**
 * Per-tenant lead notification recipients, and the test-lead filter that keeps
 * synthetic traffic off those recipients' inboxes.
 *
 * The hub notifies exactly one address for every tenant (`OWNER_EMAIL` in
 * lib/inbound-notify.ts). Some tenants have a second person who needs to see
 * real leads as they land. That person must never receive a smoke test, a QA
 * submission, or the operator poking at their own form.
 *
 * Two rules govern everything here:
 *
 *  1. NOTHING in this module may prevent a lead from being captured, and
 *     nothing may stop the owner's own notification. The CC is delivered as a
 *     separate best-effort message precisely so a bad address cannot 503 the
 *     tenant's intake — Resend validates the whole recipient set, and the
 *     inbound route is fail-closed on the owner receipt.
 *
 *  2. Ambiguity resolves toward the real lead. A stray test row costs the
 *     recipient one glance; a suppressed genuine prospect is unrecoverable,
 *     because for this tenant the email IS the delivery channel.
 */

/**
 * Slug → additional addresses CC'd on genuine lead notifications.
 *
 * leadfranchise covers every form on leadfranchise.org — services access,
 * service reservations, and newsletter signups all POST to the one
 * /api/inbound/leadfranchise/leads endpoint, so this single entry reaches all
 * of them. Added at the owner's request 2026-08-05.
 */
const LEAD_CC: Record<string, readonly string[]> = {
  leadfranchise: [
    'ranceolison45@gmail.com',
    'mohammad.syed.1001@gmail.com',
  ],
};

/**
 * Display names for registry-driven tenants, which sit outside the legacy
 * `INBOUND_SLUG_LABELS` union. Without this the subject line reads
 * "New leadfranchise lead" — the raw database slug.
 */
export const REGISTRY_BRAND_LABELS: Record<string, string> = {
  leadfranchise: 'Lead Franchise',
  huron: 'Huron',
  mafi: 'Mafi',
  mythosais: 'Mythos AIS',
};

/**
 * Per-tenant sender for lead notifications.
 *
 * A tenant with its own verified domain should send from it: the alert is
 * instantly recognisable in the inbox, and the tenant's reputation is its own
 * rather than pooled with every other brand on the shared sender.
 *
 * Every value here MUST be a domain verified in the Resend account. Sending
 * from an unverified domain is rejected outright, and because the inbound route
 * is fail-closed on the owner receipt that turns into a 503 on the tenant's
 * lead form — real visitors turned away. This is not hypothetical: it happened
 * on 2026-08-06 when omnileadsagi.com was removed from the account.
 */
const LEAD_FROM: Record<string, string> = {
  leadfranchise: 'Lead Franchise <alerts@leadfranchise.org>',
};

/** Sender for a tenant's lead alert, falling back to the house sender. */
export function leadFromAddress(slug: string, fallback: string): string {
  return LEAD_FROM[slug] ?? fallback;
}

export type LeadIdentity = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  /** The originating site's intake row id. Absent on hand-rolled probes. */
  intakeId?: string | null;
};

/** Mailboxes the operator uses to exercise their own forms. */
const OPERATOR_MAILBOXES = new Set(['sitanim8@gmail.com']);

/** Operator phone numbers, digits only, country code stripped. */
const OPERATOR_PHONES = new Set(['8014581756', '8888888888']);

/** Domains the operator sends FROM. A lead arriving from one is internal. */
const OPERATOR_DOMAINS = new Set(['omnios.news', 'omnileadsagi.com']);

/** RFC 2606 / RFC 6761 names reserved so they can never belong to a real person. */
const RESERVED_TLDS = new Set(['test', 'invalid', 'example', 'localhost']);
const RESERVED_DOMAINS = new Set(['example.com', 'example.org', 'example.net']);

/** Filler a human types when they are not really filling the form in. */
const FILLER_NAMES = new Set([
  'test',
  'test test',
  'testing',
  'tester',
  'asdf',
  'asdfasdf',
  'qwerty',
  'aaa',
  'abc',
  '$mafi',
  'mafi',
  'website visitor',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reduce an address to the mailbox it actually delivers to, so
 * `sitanim8+lfv4@gmail.com` and `Sit.AnIm8@googlemail.com` both resolve to
 * `sitanim8@gmail.com`.
 *
 * Plus-tagging alone is NEVER a test signal — agencies routinely tag by client
 * (`jordan+leadfranchise@agency.com`) and those are real prospects.
 */
function canonicalMailbox(email: string): string {
  const [local = '', domain = ''] = email
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .split('@');
  if (!local || !domain) return '';
  const untagged = local.split('+')[0];
  const isGoogle = domain === 'gmail.com' || domain === 'googlemail.com';
  return isGoogle
    ? `${untagged.replace(/\./g, '')}@gmail.com`
    : `${untagged}@${domain}`;
}

function digitsOnly(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits;
}

/**
 * Returns a short reason string when the submission is demonstrably synthetic,
 * or null when it should be treated as a genuine lead.
 *
 * Deliberately NOT test signals — each was considered and rejected:
 *  - the name `there`: the newsletter route substitutes it whenever a
 *    subscriber gives only an email, which is the normal path for a REAL
 *    subscriber. Keying on it would suppress every newsletter lead.
 *  - a `*.vercel.app` page URL: several tenants are served from their Vercel
 *    alias because the apex is not owned, so that is where 100% of genuine
 *    traffic originates.
 *  - a `test_` source prefix: unreachable given the site's source vocabulary,
 *    and it would collide with real franchise verticals like `test_prep`.
 *  - the mere presence of `+` in an address: that is ordinary sub-addressing.
 */
export function isTestLead(lead: LeadIdentity): string | null {
  const source = (lead.source ?? '').toLowerCase().trim();
  if (source.endsWith('_honeypot')) return 'honeypot';

  const email = (lead.email ?? '').normalize('NFKC').toLowerCase().trim();
  if (email) {
    // Exact label comparison, never substring: contest.com, protest.io and
    // example-consulting.com are all perfectly ordinary real domains.
    const domain = email.split('@')[1] ?? '';
    const labels = domain.split('.');
    const tld = labels[labels.length - 1] ?? '';
    if (RESERVED_DOMAINS.has(domain)) return 'reserved-domain';
    if (RESERVED_TLDS.has(tld)) return 'reserved-tld';
    if (OPERATOR_DOMAINS.has(domain)) return 'operator-domain';
    if (OPERATOR_MAILBOXES.has(canonicalMailbox(email))) return 'operator-email';
  }

  const phone = digitsOnly(lead.phone ?? '');
  if (phone && OPERATOR_PHONES.has(phone)) return 'operator-phone';

  const name = (lead.name ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
  const lowered = name.toLowerCase();
  if (lowered && FILLER_NAMES.has(lowered)) return 'filler-name';
  // The operator's own convention for disposable verification rows.
  if (/^zz[\s_-]/i.test(name)) return 'zz-marker';

  return null;
}

/** Set LEAD_CC_ENABLED=0 to stop every tenant CC without a redeploy. */
function ccGloballyEnabled(): boolean {
  return process.env.LEAD_CC_ENABLED !== '0';
}

export type CcDecision = {
  recipients: string[];
  /** Why the CC was withheld, for the persisted notification state. */
  suppressed: string | null;
};

/**
 * Decide the extra recipients for one lead.
 *
 * `ownerEmail` is excluded from the result: Resend 422s on a recipient that
 * appears in both `to` and `cc`, and a 422 here must never become a tenant
 * outage.
 */
export function leadCcDecision(
  slug: string,
  lead: LeadIdentity,
  ownerEmail: string,
): CcDecision {
  const configured = LEAD_CC[slug];
  if (!configured || configured.length === 0) {
    return { recipients: [], suppressed: null };
  }
  if (!ccGloballyEnabled()) {
    return { recipients: [], suppressed: 'globally-disabled' };
  }

  /*
   * Require the originating site's intake id. Every genuine submission carries
   * one; uptime monitors, hand-rolled curl probes and anything replaying the
   * endpoint by hand do not — so this alone keeps synthetic traffic off the
   * recipient without needing to guess from the name or address.
   */
  const intakeId = (lead.intakeId ?? '').trim();
  if (!UUID_RE.test(intakeId)) return { recipients: [], suppressed: 'no-intake-id' };

  const reason = isTestLead(lead);
  if (reason) return { recipients: [], suppressed: reason };

  const owner = ownerEmail.toLowerCase().trim();
  const recipients = Array.from(
    new Set(configured.map((a) => a.toLowerCase().trim())),
  ).filter((a) => a && a !== owner);

  return { recipients, suppressed: null };
}
