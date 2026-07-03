"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SubscribeForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("request_failed");
      }

      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] p-1.5 pl-5 backdrop-blur-sm transition-colors focus-within:border-[hsl(var(--primary))]">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-label="Email address"
            disabled={submitting}
            className="flex-1 bg-transparent text-[15px] text-[hsl(var(--foreground))] placeholder:text-white/35 outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Joining" : "Join Free"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-3 text-center text-sm text-[hsl(var(--destructive-foreground))]/90">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-1.5">
        <Link
          href="/"
          className="text-sm text-white/55 transition-colors hover:text-white"
        >
          Already subscribed? &rarr;
        </Link>
        <p className="text-xs text-white/30">Unsubscribe anytime.</p>
      </div>
    </div>
  );
}
