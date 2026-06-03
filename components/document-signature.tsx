"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import {
  DOCUMENT_SIGNATURE_CREDIT,
  DOCUMENT_SIGNATURES,
  type DocumentSignatureSlug,
} from "@/lib/document-signatures";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

type SignatureStatus =
  | "idle"
  | "loading"
  | "submitting"
  | "signed"
  | "check-error"
  | "form-error";

type SignatureSnapshot = {
  signatureId: string | null;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  creditAwarded: number;
  creditAwardedNow: number;
  alreadySigned: boolean;
};

type SignatureApiResponse = {
  signed?: boolean;
  alreadySigned?: boolean;
  signatureId?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAt?: string | null;
  creditAwarded?: number;
  creditAwardedNow?: number;
  message?: string;
  error?: string;
};

const SIGNATURE_CACHE_VERSION = 1;

type CachedSignatureSnapshot = SignatureSnapshot & {
  version: number;
  userId: string;
  documentSlug: DocumentSignatureSlug;
};

function signatureCacheKey(userId: string, documentSlug: DocumentSignatureSlug) {
  return `omni_document_signature:${userId}:${documentSlug}`;
}

function readCachedSignature(
  userId: string,
  documentSlug: DocumentSignatureSlug,
): SignatureSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(signatureCacheKey(userId, documentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSignatureSnapshot>;
    if (
      parsed.version !== SIGNATURE_CACHE_VERSION ||
      parsed.userId !== userId ||
      parsed.documentSlug !== documentSlug ||
      typeof parsed.signedAt !== "string" ||
      !parsed.signedAt
    ) {
      return null;
    }

    return {
      signatureId: parsed.signatureId || null,
      signerName: parsed.signerName || "Signed account",
      signerEmail: parsed.signerEmail || "",
      signedAt: parsed.signedAt,
      creditAwarded:
        typeof parsed.creditAwarded === "number"
          ? parsed.creditAwarded
          : DOCUMENT_SIGNATURE_CREDIT,
      creditAwardedNow: 0,
      alreadySigned: true,
    };
  } catch {
    return null;
  }
}

function writeCachedSignature(
  userId: string,
  documentSlug: DocumentSignatureSlug,
  snapshot: SignatureSnapshot,
) {
  if (typeof window === "undefined") return;
  try {
    const cached: CachedSignatureSnapshot = {
      ...snapshot,
      version: SIGNATURE_CACHE_VERSION,
      userId,
      documentSlug,
      creditAwardedNow: 0,
      alreadySigned: true,
    };
    window.localStorage.setItem(
      signatureCacheKey(userId, documentSlug),
      JSON.stringify(cached),
    );
  } catch {
    // A full or unavailable localStorage should not block the source of truth.
  }
}

function clearCachedSignature(userId: string, documentSlug: DocumentSignatureSlug) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(signatureCacheKey(userId, documentSlug));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function DocumentSignature({
  documentSlug,
}: {
  documentSlug: DocumentSignatureSlug;
}) {
  const definition = DOCUMENT_SIGNATURES[documentSlug];
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [status, setStatus] = useState<SignatureStatus>("idle");
  const [snapshot, setSnapshot] = useState<SignatureSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [checkedKey, setCheckedKey] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  const accountEmail = user?.email || "";
  const activeSignatureKey = user?.id
    ? signatureCacheKey(user.id, documentSlug)
    : "";
  const defaultName = useMemo(() => {
    const username = user?.username?.replace(/^[@$]+/, "").trim();
    return username || "";
  }, [user?.username]);

  useEffect(() => {
    if (!signerName && defaultName) setSignerName(defaultName);
  }, [defaultName, signerName]);

  useEffect(() => {
    let cancelled = false;

    async function loadSignature() {
      if (loading) return;
      if (!user) {
        setStatus("idle");
        setSnapshot(null);
        setCheckedKey("");
        return;
      }

      const cached = readCachedSignature(user.id, documentSlug);
      if (cached) {
        setSnapshot(cached);
        setStatus("signed");
        setCheckedKey(signatureCacheKey(user.id, documentSlug));
      } else {
        setStatus("loading");
      }
      setMessage("");

      try {
        const res = await authFetch(
          `/api/document-signatures?documentSlug=${encodeURIComponent(documentSlug)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as SignatureApiResponse;
        if (cancelled) return;

        if (!res.ok) {
          if (cached) {
            setStatus("signed");
            setMessage("");
          } else if (res.status === 401) {
            setStatus("check-error");
            setMessage(
              "Sign in to seal this document and claim your +10 Omni credits.",
            );
          } else {
            setStatus("check-error");
            setMessage(data.error || "Could not check this signature yet.");
          }
          return;
        }

        if (data.signed && data.signedAt) {
          const nextSnapshot = {
            signatureId: data.signatureId || null,
            signerName: data.signerName || defaultName || "Signed account",
            signerEmail: data.signerEmail || accountEmail,
            signedAt: data.signedAt,
            creditAwarded: data.creditAwarded || DOCUMENT_SIGNATURE_CREDIT,
            creditAwardedNow: data.creditAwardedNow || 0,
            alreadySigned: true,
          };
          setSnapshot(nextSnapshot);
          writeCachedSignature(user.id, documentSlug, nextSnapshot);
          setCheckedKey(signatureCacheKey(user.id, documentSlug));
          setStatus("signed");
          return;
        }

        clearCachedSignature(user.id, documentSlug);
        setSnapshot(null);
        setCheckedKey(signatureCacheKey(user.id, documentSlug));
        setStatus("idle");
      } catch {
        if (!cancelled) {
          if (cached) {
            setStatus("signed");
            setMessage("");
          } else {
            setStatus("check-error");
            setMessage("Could not reach the signature service yet.");
          }
        }
      }
    }

    void loadSignature();

    return () => {
      cancelled = true;
    };
  }, [accountEmail, defaultName, documentSlug, loading, retryNonce, user]);

  const loginHref = useMemo(() => {
    const target = `${pathname || definition.path}#signature`;
    return `/login?next=${encodeURIComponent(target)}`;
  }, [definition.path, pathname]);

  const handleSignedOutClick = () => {
    setMessage("Sign in to seal this document and claim your +10 Omni credits.");
    router.push(loginHref);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      handleSignedOutClick();
      return;
    }

    const cleanName = signerName.trim();
    if (cleanName.length < 2) {
      setStatus("form-error");
      setMessage("Type your name to sign.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const res = await authFetch("/api/document-signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentSlug,
          signerName: cleanName,
          pageUrl:
            typeof window !== "undefined"
              ? window.location.href
              : definition.path,
          website: "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as SignatureApiResponse;

      if (!res.ok) {
        if (res.status === 401) {
          handleSignedOutClick();
          return;
        }
        setStatus("form-error");
        setMessage(data.error || "Could not capture the signature yet.");
        return;
      }

      if (!data.signedAt) {
        setStatus("form-error");
        setMessage("The signature response was incomplete. Try again.");
        return;
      }

      const nextSnapshot = {
        signatureId: data.signatureId || null,
        signerName: data.signerName || cleanName,
        signerEmail: data.signerEmail || accountEmail,
        signedAt: data.signedAt,
        creditAwarded: data.creditAwarded || DOCUMENT_SIGNATURE_CREDIT,
        creditAwardedNow: data.creditAwardedNow || 0,
        alreadySigned: Boolean(data.alreadySigned),
      };
      setSnapshot(nextSnapshot);
      writeCachedSignature(user.id, documentSlug, nextSnapshot);
      setCheckedKey(signatureCacheKey(user.id, documentSlug));
      setStatus("signed");
      setMessage(
        data.message ||
          `Acknowledgement recorded. +${DOCUMENT_SIGNATURE_CREDIT} Omni credits have been added.`,
      );
    } catch {
      setStatus("form-error");
      setMessage("Could not reach the signature service. Try again.");
    }
  };

  if (!loading && !user) {
    return (
      <section id="signature" className="border-t border-white/[0.08] py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-lg border border-amber-300/25 bg-black/50 p-5 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(251,191,36,0.16),transparent_34%),radial-gradient(circle_at_18%_86%,rgba(56,189,248,0.10),transparent_36%)]" />
          <div className="relative grid gap-7 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-200/30 bg-amber-200/10 text-amber-100">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-serif text-[clamp(2rem,9vw,3.6rem)] leading-tight text-white">
                Seal {definition.title}.
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-8 text-zinc-300 sm:text-lg">
                Sign in to seal this document and claim your +10 Omni credits.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <p className="text-sm leading-7 text-zinc-300">
                Your acknowledgement is tied to your Omni account, timestamped,
                and credited once for this document.
              </p>
              <button
                type="button"
                onClick={handleSignedOutClick}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-amber-200/30 bg-amber-200/10 px-4 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-100/60 sm:w-auto"
              >
                <Lock className="h-4 w-4" />
                Sign in to seal
              </button>
              {message ? (
                <p className="mt-4 text-sm leading-6 text-amber-100" role="status">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const needsInitialCheck =
    Boolean(user) &&
    !snapshot &&
    checkedKey !== activeSignatureKey &&
    status !== "check-error";

  if (status === "loading" || loading || needsInitialCheck) {
    return (
      <section id="signature" className="border-t border-white/[0.08] py-12 sm:py-16">
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin text-amber-200" />
            <span className="text-sm font-semibold">Checking signature status</span>
          </div>
        </div>
      </section>
    );
  }

  if (status === "check-error") {
    return (
      <section id="signature" className="border-t border-white/[0.08] py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-lg border border-amber-300/25 bg-black/50 p-5 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(251,191,36,0.16),transparent_34%),radial-gradient(circle_at_18%_86%,rgba(56,189,248,0.10),transparent_36%)]" />
          <div className="relative max-w-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-200/30 bg-amber-200/10 text-amber-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase text-amber-200/80">
              Acknowledgement status
            </p>
            <h2 className="mt-3 font-serif text-[clamp(2rem,9vw,3.6rem)] leading-tight text-white">
              Checking {definition.title}.
            </h2>
            <p className="mt-5 text-[15px] leading-8 text-zinc-300 sm:text-lg">
              {message ||
                "The signature service did not answer cleanly. Retry before signing so we can avoid duplicate attempts."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setStatus("loading");
                  setMessage("");
                  setRetryNonce((value) => value + 1);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-amber-200/30 bg-amber-200/10 px-4 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-100/60"
              >
                <Loader2 className="h-4 w-4" />
                Check again
              </button>
              <button
                type="button"
                onClick={handleSignedOutClick}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/25"
              >
                <Lock className="h-4 w-4" />
                Sign in again
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (snapshot) {
    const signedAt = new Date(snapshot.signedAt);
    const formattedSignedAt = Number.isNaN(signedAt.getTime())
      ? snapshot.signedAt
      : new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(signedAt);
    const justAwarded = snapshot.creditAwardedNow > 0 && !snapshot.alreadySigned;

    return (
      <section id="signature" className="border-t border-white/[0.08] py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-lg border border-emerald-300/25 bg-black/50 p-6 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_20%,rgba(251,191,36,0.20),transparent_34%),radial-gradient(circle_at_16%_78%,rgba(16,185,129,0.16),transparent_34%)]" />
          <div className="relative max-w-3xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-200/30 bg-emerald-200/10 text-emerald-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase text-emerald-200/80">
              Acknowledgement sealed
            </p>
            <h2 className="mt-3 font-serif text-[clamp(2.25rem,9vw,4.1rem)] leading-tight text-white">
              {definition.title} is sealed.
            </h2>
            <p className="mt-5 text-[16px] leading-8 text-zinc-200 sm:text-xl">
              {justAwarded
                ? `${snapshot.signerName}, +${snapshot.creditAwarded} Omni credits have been added to your credit with Omni AI.`
                : `${snapshot.signerName}, this document is already sealed to your Omni account. No duplicate credit was created.`}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase text-zinc-500">
                  Signed by
                </p>
                <p className="mt-2 font-serif text-2xl italic text-white">
                  {snapshot.signerName}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase text-zinc-500">
                  Account
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-white">
                  {snapshot.signerEmail}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase text-zinc-500">
                  Credit
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">
                  +{snapshot.creditAwarded}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-6 text-zinc-500">
              Sealed {formattedSignedAt}
            </p>
            {message ? (
              <p className="mt-5 text-sm leading-6 text-emerald-300" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="signature" className="border-t border-white/[0.08] py-12 sm:py-16">
      <div className="relative overflow-hidden rounded-lg border border-amber-300/25 bg-black/50 p-5 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(251,191,36,0.16),transparent_34%),radial-gradient(circle_at_18%_86%,rgba(56,189,248,0.10),transparent_36%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-200/80">
              Electronic acknowledgement
            </p>
            <h2 className="mt-3 font-serif text-[clamp(2rem,9vw,3.6rem)] leading-tight text-white">
              I have read {definition.title}.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-8 text-zinc-300 sm:text-lg">
              Type your name to seal this document to your Omni account and
              claim +{DOCUMENT_SIGNATURE_CREDIT} Omni credits once.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              aria-hidden="true"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
            />
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-zinc-500">
                Signature
              </span>
              <div className="relative overflow-hidden border-b border-amber-200/35 bg-transparent transition-colors focus-within:border-amber-100/70">
                <span
                  className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-serif text-4xl italic text-white/[0.06] transition-opacity sm:text-5xl ${
                    signerName.trim() ? "opacity-0" : "opacity-100"
                  }`}
                >
                  Sign here
                </span>
                <input
                  value={signerName}
                  onChange={(event) => {
                    setSignerName(event.target.value);
                    if (status !== "idle") setStatus("idle");
                    if (message) setMessage("");
                  }}
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Type your full name"
                  className="relative h-16 w-full bg-transparent px-0 font-serif text-2xl italic text-white outline-none placeholder:text-zinc-500 sm:h-20 sm:text-3xl"
                />
              </div>
            </label>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                Omni account
              </p>
              <div className="flex min-h-12 items-center rounded-md border border-white/10 bg-white/[0.035] px-3 text-sm font-semibold text-zinc-200">
                {accountEmail}
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-amber-200/30 bg-amber-200/10 px-4 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-100/60 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {status === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status === "signed" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <PenLine className="h-4 w-4" />
              )}
              Submit acknowledgement
            </button>

            {message ? (
              <p
                className={`text-sm leading-6 ${
                  status === "form-error" ? "text-rose-300" : "text-emerald-300"
                }`}
                role="status"
              >
                {message}
              </p>
            ) : (
              <p className="text-xs leading-6 text-zinc-500">
                Each document can award credit once per Omni account.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
