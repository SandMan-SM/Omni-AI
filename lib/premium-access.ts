/*
 * Local record of the limited-time free Premium grant.
 *
 * THE BUG THIS FIXES: POST /api/newsletter with offer "premium-limited-time"
 * sets subscription_tier = "premium" in the database and returns
 * { premium: true }. The signup form then said "Premium unlocked" — but the
 * gate asks a completely different question. It calls getStoredUser(), which
 * begins with decodeStoredTokenPayload() and returns null without a valid AUTH
 * TOKEN. An email address is not a sign-in, so that check could never pass, and
 * the premium cards stayed locked forever while the database insisted the
 * reader was premium. The success message was simply false.
 *
 * This is the missing third piece: a browser-side record that the grant
 * happened, which the gate consults alongside the signed-in user.
 *
 * Scope, deliberately: it unlocks NAVIGATION — the premium cards link to the
 * issue instead of bouncing to the upsell. It is not an authorization boundary
 * and must never be treated as one. It cannot be, because the issue bodies are
 * not access-controlled server-side anyway: /newsletter/<premium-slug> already
 * returns the full article to anyone with the URL. Nothing here widens what a
 * determined visitor can reach; it just stops lying to the ones who complied.
 */

const KEY = 'omni_premium_access';

export type PremiumGrant = { email: string; grantedAt: string };

export function grantLocalPremiumAccess(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    const record: PremiumGrant = { email, grantedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Private browsing or a full quota. The redirect still happens; the reader
    // simply has to re-enter their email next visit rather than seeing an error.
  }
}

export function hasLocalPremiumAccess(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<PremiumGrant>;
    return typeof parsed?.email === 'string' && parsed.email.includes('@');
  } catch {
    return false;
  }
}
