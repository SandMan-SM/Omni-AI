"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import {
  createLead,
  getStoredUser,
  getSupabaseUser,
  login,
  loginWithOAuth,
  logout as authLogout,
  omniUserFromSupabaseUser,
} from '@/lib/auth';
import type { OAuthProvider, OmniUser } from '@/lib/auth';

interface AuthContextType {
  user: OmniUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signInWithProvider: (provider: OAuthProvider, redirectTo?: string | null) => Promise<{ error: string | null }>;
  signUp: (name: string, email: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OmniUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserClient();
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    getSupabaseUser()
      .then((supabaseUser) => {
        if (!active) return;
        if (!storedUser && supabaseUser) setUser(supabaseUser);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentStoredUser = getStoredUser();
      if (currentStoredUser) {
        setUser(currentStoredUser);
        return;
      }
      setUser(session?.user ? omniUserFromSupabaseUser(session.user) : null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    const result = await login(username, password);
    if (!result.error) {
      setUser(getStoredUser());
    }
    return result;
  };

  const signUp = async (name: string, email: string, phone: string) => {
    return await createLead(name, email, phone);
  };

  const signInWithProvider = async (
    provider: OAuthProvider,
    redirectTo?: string | null,
  ) => {
    return await loginWithOAuth(provider, redirectTo);
  };

  const signOut = async () => {
    await authLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithProvider, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
