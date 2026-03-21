const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    email: string;
    tier: string;
    is_admin: boolean;
    is_sponsor: boolean;
  };
}

export async function login(username: string, password: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || 'Login failed' };
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

export function getStoredUser() {
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

export async function createLead(name: string, email: string, phone: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.detail || 'Failed to submit' };
    }

    return { error: null };
  } catch (err) {
    return { error: 'Connection error. Please try again.' };
  }
}
