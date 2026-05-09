"use client";

// Client-side gate for /federation/case-studies/* surfaces.
// Allowed: $Mafi (sita), Fred, Benji — every other authenticated user
// or anonymous visitor sees the inline login form.
//
// The federation does not have a /auth page; auth is modal-based on the
// homepage. So the gate inlines its own form using the same useAuth()
// signIn() that the AuthModal uses underneath.

import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useState } from "react";

const ALLOWED_USERNAMES = new Set([
  "mafi", "$mafi", "fred", "benji", "alfred",
]);
const ALLOWED_EMAILS = new Set([
  "sitanim8@gmail.com",
  "alfred@omnileadsagi.com",
]);

function isAuthorized(user: { username?: string; email?: string } | null): boolean {
  if (!user) return false;
  const u = (user.username || "").toLowerCase();
  const e = (user.email || "").toLowerCase();
  return ALLOWED_USERNAMES.has(u) || ALLOWED_EMAILS.has(e);
}

export default function CaseStudyGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="min-h-screen text-zinc-100 relative z-10 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse [animation-delay:120ms]" />
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse [animation-delay:240ms]" />
          <span className="text-xs uppercase tracking-[0.32em] ml-2">Verifying access…</span>
        </div>
      </main>
    );
  }

  if (isAuthorized(user)) {
    return <>{children}</>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErr(null);
    setSubmitting(true);
    const res = await signIn(username.trim(), password);
    setSubmitting(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    // signIn updated the AuthContext; the next render will check
    // isAuthorized again. If they signed in as someone NOT on the
    // allowlist, the form will show the "not on access list" state
    // automatically.
  }

  const signedInButNotAllowed = !!user;

  return (
    <main className="min-h-screen text-zinc-100 relative z-10">
      <section className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Locked</p>
        <h1 className="mt-4 text-4xl sm:text-5xl tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
          Inner-circle only.
        </h1>
        <p className="mt-4 text-zinc-400 leading-relaxed text-sm">
          Federation case studies are reserved for the inner circle — $Mafi, Fred, Benji.
          The rest of the network is public; this surface isn&apos;t.
        </p>

        {signedInButNotAllowed && (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
            <p className="text-zinc-400">
              Signed in as{" "}
              <span className="text-amber-300">{user!.username || user!.email}</span>.
              Not on the access list.
            </p>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setUsername("");
                setPassword("");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:border-amber-400 hover:text-amber-300 transition-colors"
            >
              Sign out + switch account
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.32em] text-zinc-500">Username</span>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Benji / Fred / $Mafi"
              required
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.32em] text-zinc-500">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 focus:border-amber-400 outline-none"
            />
          </label>

          {err && (
            <p className="text-sm text-rose-400">{err}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-zinc-900 hover:bg-amber-300 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.28em] text-zinc-500 hover:text-amber-300"
          >
            ← Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
