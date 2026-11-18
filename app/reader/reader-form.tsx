"use client";
import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import styles from "./reader.module.css";

type Step = "email" | "code" | "profile" | "ready";
const titles: Record<Step, string> = {
  email: "Get the daily briefing.",
  code: "Check your inbox.",
  profile: "Set up your reader account.",
  ready: "You’re signed in.",
};
export function ReaderForm({ source }: { source: string }) {
  const [step, setStep] = useState<Step>("email"),
    [challenge, setChallenge] = useState(""),
    [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/reader", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        if (r.step) setStep(r.step);
        else if (r.error) setError(r.error);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const action = {
      email: "request",
      code: "verify",
      profile: "profile",
      ready: "logout",
    }[step];
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          action,
          challenge,
          email,
          consent: data.consent === "on",
          source,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.step)
        throw new Error(result.error || "Please try again.");
      if (result.challenge) setChallenge(result.challenge);
      setStep(result.step);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{titles[step]}</h1>
      <p>
        {step === "email"
          ? "One AI development worth your attention and one practical way to use it. Enter your email to join or sign back in."
          : step === "code"
            ? "Enter the six-digit code sent to " +
              email +
              ". It expires in ten minutes."
            : step === "profile"
              ? "Two details for your reader profile. We deliver the briefing by email."
              : "Your next issue will arrive by email if your subscription is active."}
      </p>
      <form onSubmit={submit} key={step}>
        {step === "email" && (
          <div hidden aria-hidden="true">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        )}
        {step === "email" && (
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </label>
        )}
        {step === "code" && (
          <label>
            Sign-in code
            <input
              className={styles.code}
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </label>
        )}
        {step === "profile" && (
          <>
            <label>
              Full name
              <input
                name="fullName"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                maxLength={25}
                required
              />
            </label>
            <label className={styles.consent}>
              <input name="consent" type="checkbox" required />
              Email me the daily Interlinked newsletter. I can unsubscribe
              anytime.
            </label>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {step === "ready" && (
          <Link className={styles.primary} href="/newsletter">
            Read the current issue shelf →
          </Link>
        )}
        <button
          className={step === "ready" ? styles.secondary : styles.primary}
          disabled={busy}
        >
          {busy
            ? "One moment…"
            : {
                email: "Email my code",
                code: "Verify code",
                profile: "Create account and subscribe",
                ready: "Sign out",
              }[step]}
        </button>
        {step === "code" && (
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => {
              setStep("email");
              setError("");
            }}
          >
            Request another code or change email
          </button>
        )}
      </form>
    </>
  );
}
