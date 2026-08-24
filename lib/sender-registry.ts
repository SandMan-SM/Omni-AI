/**
 * THE single source of truth for who mail is sent as.
 *
 * Why this file exists: sending identity used to live in ~25 hardcoded
 * constants, several env vars, and a per-brand `dispatch@<domain>` default —
 * with nothing checking any of it against the domains that can actually send.
 * Two consequences, both of which bit hard:
 *
 *  1. On 2026-08-06 `omnileadsagi.com` was removed from the Resend account.
 *     Every one of those constants became unsendable at once, and because the
 *     lead route is fail-closed on the owner receipt, every tenant's lead form
 *     started returning 503 and turning real visitors away.
 *
 *  2. The federation newsletter pipeline defaults to `dispatch@<brand domain>`,
 *     but only a handful of brand domains are verified. Every unverified brand
 *     silently failed to send, one at a time, with nobody watching.
 *
 * The rule enforced here: a sender is only ever emitted for a VERIFIED domain.
 * Anything else falls back to the house sender rather than failing at Resend.
 */

/**
 * Domains verified for sending in the Resend account.
 *
 * KEEP IN SYNC with the account — `resend.list-domains`, status `verified`.
 * Removing a domain here is safe (senders fall back). Adding one that is NOT
 * actually verified re-creates the outage this file exists to prevent.
 *
 * Last reconciled 2026-08-06.
 */
export const VERIFIED_SENDING_DOMAINS = new Set([
  'leadfranchise.org',
  'sitanimafi.com',
  'omnios.news',
  'theixnetwork.com',
  'utahmainstreet.com',
  'secretimperium.com',
  'lovethybarber.shop',
  'alira.live',
]);

/** The house sender. Must always be a verified domain. */
export const HOUSE_DOMAIN = 'omnios.news';

/**
 * Brand → the domain its mail should come from, where that differs from the
 * brand's own web domain.
 *
 * Owner's decisions, 2026-08-06:
 *   - Interlinked / Omni AI newsletters  → omnios.news
 *   - Utah Main Street                   → utahmainstreet.com
 *   - Lead Franchise                     → leadfranchise.org
 *
 * A brand whose own domain is verified needs no entry — it is used directly.
 */
const BRAND_SENDING_DOMAIN: Record<string, string> = {
  // Interlinked is the Omni AI newsletter; it sends as the house, not as the hub.
  'omnileadsagi.com': HOUSE_DOMAIN,
  'mythosais.com': HOUSE_DOMAIN,
  'obsidian.casino': HOUSE_DOMAIN,
  /*
   * CPS sends from leadfranchise.org by owner decision (2026-08-06).
   * Worth knowing: recipients are clinical/custody-evaluation contacts, and
   * mail from a lead-generation brand may read as unrelated to them.
   */
  'psychandcustodyevaluations.com': 'leadfranchise.org',
  'utahmainstreet.com': 'utahmainstreet.com',
  'leadfranchise.org': 'leadfranchise.org',
  'theixnetwork.com': 'theixnetwork.com',
  'sitanimafi.com': 'sitanimafi.com',
  'alira.live': 'alira.live',
  'secretimperium.com': 'secretimperium.com',
  'lovethybarber.shop': 'lovethybarber.shop',
};

function domainOf(address: string): string {
  return (address.split('@')[1] ?? '').toLowerCase().trim();
}

/** True when an address can actually be sent from right now. */
export function isSendable(address: string): boolean {
  return VERIFIED_SENDING_DOMAINS.has(domainOf(address));
}

export type ResolvedSender = {
  /** RFC 5322 `Name <local@domain>`, always on a verified domain. */
  from: string;
  /** The domain actually used. */
  domain: string;
  /** True when the brand's preferred domain was not verified. */
  fellBack: boolean;
};

/**
 * Resolve the From header for a brand.
 *
 * `brandDomain` is the brand's web domain (e.g. `thewasatchpost.com`).
 * `localPart` is the mailbox (`newsletter`, `alerts`, `dispatch`, …).
 *
 * Never returns an unverified domain. When the brand's own domain cannot send,
 * it falls back to the house domain and says so, so callers can log it rather
 * than discover the problem through a bounced campaign.
 */
export function resolveSender(
  brandName: string,
  brandDomain: string,
  localPart = 'newsletter',
): ResolvedSender {
  const preferred =
    BRAND_SENDING_DOMAIN[brandDomain.toLowerCase()] ?? brandDomain.toLowerCase();

  const usable = VERIFIED_SENDING_DOMAINS.has(preferred);
  const domain = usable ? preferred : HOUSE_DOMAIN;

  if (!usable) {
    console.warn(
      `[sender-registry] ${brandName} wanted ${preferred}, which is not a ` +
        `verified sending domain — falling back to ${HOUSE_DOMAIN}. ` +
        `Verify it in Resend and add it to VERIFIED_SENDING_DOMAINS.`,
    );
  }

  return {
    from: `${brandName} <${localPart}@${domain}>`,
    domain,
    fellBack: !usable,
  };
}
