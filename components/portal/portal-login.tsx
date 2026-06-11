"use client";

import { useState } from "react";

export function PortalLogin({
  onLogin,
}: {
  onLogin: (username: string, password: string) => boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = onLogin(username, password);
    if (!ok) setError("Invalid username or password");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-24 text-white">
      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card neon-border rounded-3xl p-8 md:p-10">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-purple-300/80">
            Client Portal
          </p>
          <h1 className="text-gradient mb-2 text-3xl font-bold md:text-4xl">
            Omni Leads AGI
          </h1>
          <p className="mb-8 text-sm text-gray-400">
            Sign in with your portal username and password.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="Username"
              autoComplete="off"
              autoCapitalize="none"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Password"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none"
            />
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3.5 font-medium text-white transition hover:from-purple-500 hover:to-blue-500"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
