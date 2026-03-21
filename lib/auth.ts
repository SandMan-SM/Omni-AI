import { createClient as createBrowserClient } from '@/lib/supabase/client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auth-login`;

export interface OmniUser {
  id: string;
  username: string;
  email: string;
  tier: string;
  is_admin: boolean;
  is_sponsor: boolean;
}

export async function login(username: string, password: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error || 'Login failed' };
    }

    localStorage.setItem('omni_token', data.access_token);
    localStorage.setItem('omni_user', JSON.stringify(data.user));

    return { error: null };
  } catch (err) {
    return { error: 'Connection error. Please try again.' };
  }
}

export async function logout(): Promise<void> {
  localStorage.removeItem('omni_token');
  localStorage.removeItem('omni_user');
}

export function getStoredUser(): OmniUser | null {
  const userStr = localStorage.getItem('omni_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('omni_token');
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getStoredUser();
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
