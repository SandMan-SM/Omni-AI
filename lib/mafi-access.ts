export type MafiIdentityLike = {
  email?: unknown;
  username?: unknown;
  name?: unknown;
  role?: unknown;
  is_admin?: unknown;
};

const MAFI_EMAILS = new Set([
  'sitanim8@gmail.com',
]);

const MAFI_USERNAMES = new Set([
  '$mafi',
  'mafi',
]);

function normalise(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Canonical full-access identity for Mafi.
 *
 * This is intentionally centralized because $Mafi must see every Omni AI
 * workspace, lead, analytics rollup, client-agent dashboard, and command-center
 * feed even if the profiles row or edge-login payload is stale/missing an
 * `is_admin=true` flag.
 */
export function isMafiIdentity(identity: MafiIdentityLike | null | undefined): boolean {
  if (!identity) return false;
  const email = normalise(identity.email);
  const username = normalise(identity.username);
  const name = normalise(identity.name);

  return Boolean(
    (email && MAFI_EMAILS.has(email)) ||
    (username && MAFI_USERNAMES.has(username)) ||
    (name && MAFI_USERNAMES.has(name))
  );
}

export function hasPlatformDashboardAccess(identity: MafiIdentityLike | null | undefined): boolean {
  if (!identity) return false;
  const role = normalise(identity.role);
  return (
    isMafiIdentity(identity) ||
    identity.is_admin === true ||
    ['admin', 'owner', 'platform', 'super_admin'].includes(role)
  );
}

export function applyMafiFullAccess<T extends MafiIdentityLike>(identity: T): T {
  if (!isMafiIdentity(identity)) return identity;
  return {
    ...identity,
    role: 'admin',
    is_admin: true,
  };
}
