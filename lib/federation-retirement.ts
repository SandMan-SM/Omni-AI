import retired from './retired-federation-tenants.json';
import publications from './retired-federation-publications.json';

// A checked-in deny list is intentional: registry caches and degraded database
// fallbacks must not reactivate an operator-retired tenant. Historical records
// stay in storage; active projections and side effects exclude these identities.
const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const identities = new Set(retired.flatMap(row => [row.tenant_slug, ...row.aliases, ...row.domains]).map(normalize));
const domains = retired.flatMap(row => row.domains);

export function isRetiredFederationIdentity(...values: unknown[]): boolean {
  return values.some(value => {
    if (typeof value !== 'string') return false;
    let text = value.trim();
    try { text = decodeURIComponent(text); } catch { /* Invalid encoding cannot broaden an identity. */ }
    if (identities.has(normalize(text))) return true;
    try {
      const host = new URL(text.includes('://') ? text : `https://${text}`).hostname.toLowerCase().replace(/^www\./, '');
      return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
    } catch { return false; }
  });
}

export function isActiveFederationRecord(value: object): boolean {
  const row = value as Record<string, unknown>;
  return !isRetiredFederationIdentity(row.slug, row.site, row.tenant_slug, row.tenantSlug, row.assetId,
    row.sourceId, row.source_id, row.client_slug, row.source_slug, row.target_slug,
    row.originating_slug, row.domain, row.website, row.siteUrl, row.name, row.displayName, row.brand, row.company,
    [row.first_name, row.last_name].filter(Boolean).join(' '));
}

export function requireActiveFederationIdentity(...values: unknown[]): void {
  if (isRetiredFederationIdentity(...values)) throw new Error('federation_tenant_retired');
}

/** Free text/media references are only used to screen active social content. */
export function hasRetiredFederationReference(...values: unknown[]): boolean {
  return values.some(value => {
    const text = normalize(typeof value === 'string' ? value : String(JSON.stringify(value ?? null)));
    return retired.some(row => [row.tenant_slug, ...row.aliases, ...row.domains].some(alias => normalize(alias).length >= 8 && text.includes(normalize(alias))));
  });
}

export function isRetiredFederationPublication(source: unknown, slug: unknown): boolean {
  return typeof source === 'string' && typeof slug === 'string'
    && publications.some(row => row.source_id === source && row.slugs.includes(slug));
}
