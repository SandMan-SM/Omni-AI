import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { decodeOmniToken, isOmniTokenPayloadFresh } from '@/lib/omni-token';
import type { User as SupabaseUser } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auth-login`;
const LOCAL_LOGIN_URL = '/api/auth/login';

export interface OmniUser {
  id: string;
  username: string;
  email: string;
  tier: string;
  tier_name: string;
  is_admin: boolean;
  is_sponsor: boolean;
  sponsor_tier?: string;
  sponsor_activated?: boolean;
}

export type OAuthProvider = 'google' | 'apple';

export async function login(username: string, password: string): Promise<{ error: string | null }> {
  try {
    const trimmedUsername = username.trim();
    const fallbackUsername = trimmedUsername.replace(/^[@$]+/, '');
    const usernamesToTry = fallbackUsername && fallbackUsername !== trimmedUsername
      ? [trimmedUsername, fallbackUsername]
      : [trimmedUsername];
    let lastError = 'Login failed';

    for (const candidateUsername of usernamesToTry) {
      const local = await postLogin(LOCAL_LOGIN_URL, candidateUsername, password, {}, 8_500);
      if (local.ok) {
        storeLoginPayload(local.data);
        return { error: null };
      }
      lastError = local.error || lastError;
      if (local.status === 401 || local.status === 400) continue;

      const edge = await postLogin(EDGE_FUNCTION_URL, candidateUsername, password, {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }, 5_500);

      if (!edge.ok) {
        console.error('Login error:', edge.error);
        lastError = edge.error || 'Login failed';
        continue;
      }

      storeLoginPayload(edge.data);
      return { error: null };
    }

    return { error: lastError };
  } catch (err) {
    return { error: 'Connection error. Please try again.' };
  }
}

async function postLogin(
  url: string,
  username: string,
  password: string,
  extraHeaders: Record<string, string>,
  timeoutMs: number,
): Promise<{ ok: true; data: any } | { ok: false; status: number; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        ...extraHeaders,
        },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
      });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || `Login failed: ${res.status}`,
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: 'Login service timed out' };
  } finally {
    clearTimeout(timeout);
  }
}

function storeLoginPayload(data: any) {
  localStorage.setItem('omni_token', data.access_token);
  localStorage.setItem('omni_user', JSON.stringify(data.user));
}

export async function logout(): Promise<void> {
  localStorage.removeItem('omni_token');
  localStorage.removeItem('omni_user');
  try {
    await createBrowserClient().auth.signOut();
  } catch {
    // Local logout should still clear the Omni token even if Supabase is slow.
  }
}

/**
 * Decode the base64(JSON) omni_token and return its payload, or null if the
 * token is missing / malformed / expired. Side-effect: when the token is
 * expired, the stored token + user are cleared so callers that previously
 * thought they were "logged in" via getStoredUser() correctly see null.
 *
 * The server (`requireAdmin`) does the same exp check — we mirror it here so
 * the client can detect the stale-token state proactively (instead of only
 * after a 401 round-trip).
 */
function decodeStoredTokenPayload(): { sub?: string; exp?: number } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('omni_token');
  if (!raw) return null;
  const payload = decodeOmniToken(raw);
  if (!isOmniTokenPayloadFresh(payload)) {
    // Token expired or malformed — purge it so subsequent reads don't keep
    // returning a user that the server has stopped accepting. The helper
    // accepts both current millisecond expirations and legacy second-based
    // expirations, so older valid sessions don't get falsely evicted.
    localStorage.removeItem('omni_token');
    localStorage.removeItem('omni_user');
    return null;
  }
  return payload as { sub?: string; exp?: number };
}

export function getStoredUser(): OmniUser | null {
  if (typeof window === 'undefined') return null;
  // First, validate the token. If it's expired/missing/malformed,
  // decodeStoredTokenPayload() purges localStorage and returns null —
  // we follow with null too so the app falls back to logged-out UX.
  if (!decodeStoredTokenPayload()) return null;
  const userStr = localStorage.getItem('omni_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Validate before returning so callers don't include a known-stale bearer.
  return decodeStoredTokenPayload() ? localStorage.getItem('omni_token') : null;
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getStoredUser();
}

export function omniUserFromSupabaseUser(user: SupabaseUser): OmniUser {
  const metadata = user.user_metadata || {};
  const metadataName =
    typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name.trim()
        : '';
  const email = user.email || '';
  const username = metadataName || email.split('@')[0] || 'member';

  return {
    id: user.id,
    username,
    email,
    tier: '0',
    tier_name: 'Apprentice',
    is_admin: false,
    is_sponsor: false,
  };
}

export async function getSupabaseUser(): Promise<OmniUser | null> {
  try {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? omniUserFromSupabaseUser(user) : null;
  } catch {
    return null;
  }
}

function currentClientPath() {
  if (typeof window === 'undefined') return '/dashboard';
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/dashboard';
}

export async function loginWithOAuth(
  provider: OAuthProvider,
  redirectTo?: string | null,
): Promise<{ error: string | null }> {
  try {
    if (typeof window === 'undefined') {
      return { error: 'OAuth sign-in is only available in the browser.' };
    }

    const next =
      typeof redirectTo === 'string' && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
        ? redirectTo
        : currentClientPath();
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callback,
      },
    });

    return { error: error?.message || null };
  } catch {
    return { error: 'Connection error. Please try again.' };
  }
}

/**
 * Build headers that forward the omni_token bearer when the user is
 * authed via the edge-function login path. Used by admin-only UI fetches
 * so they pass `requireAdmin()` regardless of whether the user has a
 * Supabase cookie session.
 *
 * Merges in any caller-supplied headers (e.g. "Content-Type" for JSON
 * POST/PATCH bodies). Server-side (no window) returns a plain object so
 * server components can still call this during SSR without crashing.
 */
export function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Convenience: fetch() with the bearer already forwarded. Use for admin
 * endpoints. Callers can still override `headers` via the second arg.
 */
export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const extra = (init.headers as Record<string, string>) || {};
  return fetch(input, { credentials: 'include', ...init, headers: authHeaders(extra) });
}

export async function createLead(name: string, email: string, phone: string): Promise<{ error: string | null }> {
  try {
    const supabase = createBrowserClient();
    const { error } = await supabase.from('leads').insert({
      name,
      email,
      phone,
      status: 'pending'
    });
    return { error: error?.message || null };
  } catch (err) {
    return { error: 'Connection error. Please try again.' };
  }
}
