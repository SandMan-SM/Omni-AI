"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { login, logout as authLogout, getStoredUser, getToken, createLead } from '@/lib/auth';

interface User {
  id: string;
  username: string;
  email: string;
  tier: string;
  is_admin: boolean;
  is_sponsor: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signUp: (name: string, email: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    return await login(username, password);
  };

  const signUp = async (name: string, email: string, phone: string) => {
    return await createLead(name, email, phone);
  };

  const signOut = async () => {
    await authLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
