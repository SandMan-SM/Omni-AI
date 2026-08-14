import { INBOUND_SLUG_LABELS, isInboundSlug } from '@/lib/inbound-types';
import { REGISTRY_BRAND_LABELS } from '@/lib/lead-recipients';

/**
 * The single sending identity for lead notifications.
 *
 * Every "someone filled out a form" alert across the whole fabric sends from
 * this one domain, per the owner's instruction. The reasons it is worth being
 * strict about:
 *
 *  - **One reputation to defend.** Lead alerts previously left from four
 *    different domains depending on which route happened to handle the form.
 *    Warming and monitoring one domain is tractable; four is not.
 *  - **One domain to verify.** The failure that matters here is silent: Resend
 *    rejects a send from an unverified domain outright, and several routes are
 *    fail-closed on the owner receipt, so an unverified sender turns into a 503
 *    on a real visitor's lead form. That is exactly what happened on 2026-08-06
 *    when omnileadsagi.com was removed from the account and took the SFD Empire
 *    intake down with it.
 *  - **One inbox rule.** Everything lands from `*@leadfranchise.org`, so the
 *    operator can filter, label and prioritise lead mail in one place.
 *
 * `leadfranchise.org` is verified in the Resend account (confirmed against the
 * live domains API, 2026-08-13). BEFORE changing LEAD_MAIL_DOMAIN, verify the
 * replacement is verified there too — the whole fabric's intake depends on it.
 */
export const LEAD_MAIL_DOMAIN = 'leadfranchise.org';

/**
 * Compose a lead sender.
 *
 * The display name carries the brand and the mailbox carries the slug, so the
 * operator can tell at a glance which site a lead came from without opening it,
 * and can filter per-brand on the To/From address. Any local part works on a
 * verified domain — no mailbox needs to exist.
 */
export function leadSender(brand: string, mailbox: string): string {
  return `New Lead ${brand} <${normaliseMailbox(mailbox)}@${LEAD_MAIL_DOMAIN}>`;
}

/**
 * A slug is only guaranteed to be lowercase and hyphen-free by convention, and
 * an address with a stray character in the local part is rejected by the
 * provider — which, on a fail-closed route, means a rejected lead. Strip
 * anything that is not safe rather than trusting the input.
 */
function normaliseMailbox(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[._-]+|[._-]+$/g, '');
  return cleaned || 'leads';
}

/**
 * Labels for registry tenants that predate REGISTRY_BRAND_LABELS or arrived
 * after it. Kept here rather than in lead-recipients.ts so adding a brand never
 * touches the CC-suppression logic, which is unit-tested and load-bearing.
 *
 * Without an entry the subject line and sender read as the raw database slug —
 * "New Lead ellietalks" rather than "New Lead Ellie Talks".
 */
const EXTRA_BRAND_LABELS: Record<string, string> = {
  ellietalks: 'Ellie Talks',
  sfdempire: 'SFD Empire',
  umsnews: 'Utah Main Street News',
};

/** Human label for a tenant slug, falling back to the slug itself. */
export function brandLabelFor(slug: string): string {
  if (isInboundSlug(slug)) return INBOUND_SLUG_LABELS[slug];
  return REGISTRY_BRAND_LABELS[slug] ?? EXTRA_BRAND_LABELS[slug] ?? slug;
}

/**
 * Sender for a tenant's lead alert.
 *
 * Derived rather than looked up in a table, so a tenant added to
 * `analytics.tenants` tomorrow gets a correct, on-domain sender with no code
 * change — the previous per-tenant map silently left every unlisted tenant on
 * the house domain.
 */
export function leadSenderFor(slug: string): string {
  return leadSender(brandLabelFor(slug), slug);
}

/**
 * Sender for the first-party Omni AI forms that are not tenant-scoped —
 * the landing pages, the waitlist, demo bookings, affiliate signups and so on.
 */
export const HOUSE_LEAD_FROM = leadSender('Omni AI', 'omniai');

/**
 * Sender for the CC copy of a lead alert.
 *
 * A distinct mailbox from the owner alert on purpose: the two messages carry
 * the same content to different audiences, and identical From addresses make
 * them collapse into one thread in most clients.
 */
export const CC_LEAD_FROM = `Lead Alerts <alerts@${LEAD_MAIL_DOMAIN}>`;
