"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [isOpen, setIsOpen] = useState(true);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
      setNextPath(requested);
    } else {
      setNextPath("/dashboard");
    }
  }, []);

  useEffect(() => {
    if (!loading && user && nextPath) {
      window.location.href = nextPath;
    }
  }, [loading, nextPath, user]);

  useEffect(() => {
    fetch("/api/auth/login", { cache: "no-store" }).catch(() => undefined);
  }, []);

  return (
    <main className="min-h-screen text-white flex items-center justify-center px-5 py-24">
      <div className="relative z-10 max-w-lg text-center space-y-6">
        <Link href="/" className="inline-flex items-center justify-center text-sm text-purple-300 hover:text-purple-200">
          ← Back to Omni AI
        </Link>
        <div className="glass-card neon-border rounded-3xl p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-300/80 mb-4">Operator access</p>
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">Sign in to Omni AI</h1>
          <p className="text-gray-400 mb-8">
            Use your Omni username and password. For the Mafi account, either <span className="text-white">$Mafi</span> or <span className="text-white">Mafi</span> will work after this fix ships.
          </p>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 font-medium text-white transition hover:from-purple-500 hover:to-blue-500"
          >
            Open sign-in
          </button>
        </div>
      </div>
      <AuthModal
        isOpen={isOpen && !user}
        onClose={() => {
          setIsOpen(false);
          if (!user) router.push("/");
        }}
      />
    </main>
  );
}
