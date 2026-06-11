"use client";

import { useEffect, useState } from "react";
import {
  authenticateDemo,
  getDemoClient,
  type DemoClient,
} from "@/lib/portal-demo-clients";
import { PortalDashboard } from "@/components/portal/portal-dashboard";
import { PortalLogin } from "@/components/portal/portal-login";

const SESSION_KEY = "omni_portal_demo_user";

export default function PortalPage() {
  const [mounted, setMounted] = useState(false);
  const [client, setClient] = useState<DemoClient | null>(null);

  // sessionStorage is read only after mount so the SSR HTML and the
  // first client render always match.
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setClient(getDemoClient(stored));
    setMounted(true);
  }, []);

  function handleLogin(username: string, password: string): boolean {
    const match = authenticateDemo(username, password);
    if (!match) return false;
    sessionStorage.setItem(SESSION_KEY, match.username);
    setClient(match);
    return true;
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setClient(null);
  }

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white">
        <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
      </main>
    );
  }

  return client ? (
    <PortalDashboard client={client} onLogout={handleLogout} />
  ) : (
    <PortalLogin onLogin={handleLogin} />
  );
}
