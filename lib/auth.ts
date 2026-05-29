import { createClient as createBrowserClient } from '@/lib/supabase/client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auth-login`;

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

export async function login(username: string, password: string): Promise<{ error: string | null }> {
  try {
    const trimmedUsername = username.trim();
    const fallbackUsername = trimmedUsername.replace(/^[@$]+/, '');
    const usernamesToTry = fallbackUsername && fallbackUsername !== trimmedUsername
      ? [trimmedUsername, fallbackUsername]
      : [trimmedUsername];
    let lastError = 'Login failed';

    for (const candidateUsername of usernamesToTry) {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ username: candidateUsername, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Login error:', data);
        lastError = data.error || 'Login failed: ' + res.status;
        continue;
      }

      localStorage.setItem('omni_token', data.access_token);
      localStorage.setItem('omni_user', JSON.stringify(data.user));

      return { error: null };
    }

    return { error: lastError };
  } catch (err) {
    return { error: 'Connection error. Please try again.' };
  }
}

export async function logout(): Promise<void> {
  localStorage.removeItem('omni_token');
  localStorage.removeItem('omni_user');
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
  try {
    const json = atob(raw);
    const payload = JSON.parse(json) as { sub?: string; exp?: number };
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) {
      // Token expired — purge it so subsequent reads don't keep returning a
      // user that the server has stopped accepting.
      localStorage.removeItem('omni_token');
      localStorage.removeItem('omni_user');
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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
  return fetch(input, { ...init, headers: authHeaders(extra) });
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
