import 'server-only';
import { createHash } from 'node:crypto';
import retired from './retired-federation-contacts.json';
import { hasRetiredFederationReference, isActiveFederationRecord } from '@/lib/federation-retirement';

// Exact contact suppressions stay server-only; no raw address is embedded in
// either client assets or the checked-in retirement receipt.
export function isRetiredFederationContact(email: unknown): boolean {
  if (typeof email !== 'string' || !email.trim()) return false;
  return retired.contact_hashes.includes(createHash('sha256').update(email.trim().toLowerCase()).digest('hex'));
}

export function isActiveFederationContact(value: object): boolean {
  const row = value as Record<string, unknown>;
  const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data as Record<string, unknown> : {};
  return isActiveFederationRecord(row) && !isRetiredFederationContact(row.email)
    && !raw.federation_retirement;
}

export function isRetiredFederationSocialPost(id: unknown, references: unknown[]): boolean {
  return typeof id === 'string' && retired.social_post_ids.includes(id.replace(/^(instagram|facebook):/, ''))
    || references.some(value => retired.media_urls.some(url => String(typeof value === 'string' ? value : JSON.stringify(value ?? null)).includes(url)))
    || hasRetiredFederationReference(...references);
}
