"use client";

// SignModal — the popup that every Activate Sponsorship button
// across every per-sponsor surface opens (Del Hasson, Debbie
// Biery, the three Mafis, etc.). Was bespoke to Del; lifted to
// the shared _components/ directory and parameterized so each
// sponsor's pages can render the same modal with their own
// sponsor name, sign endpoint, and pre-signed date.
//
// Owns:
//   - Form state (tier / amount / signerName / signerEmail /
//     submitting / error / signed)
//   - onSign POST handler against the props.signEndpoint URL
//   - Sitani's pre-signed stamp (Georgia italic 26px, dated per
//     props.sitaniSignedDate)
//   - Esc / backdrop / X close + body scroll lock — same
//     useEffect recipe as the Alira + Rene pricing modals
//
// Every sponsor's teaser + info page renders <SignModal ... />
// at the bottom of its JSX and toggles isOpen from any of its
// three Activate Sponsorship buttons.

import { useCallback, useEffect, useState } from "react";

type Tier = "01" | "02" | "03";

// Minimum contribution per tier — placeholder copy reads
// "${TIER_MINIMUMS[tier].toLocaleString()} minimum" so the
// user sees the floor for their selected tier without
// guessing. Server-side validation rejects below-min
// submissions; client-side check provides immediate feedback.
const TIER_MINIMUMS: Record<Tier, number> = {
  "01": 1000,
  "02": 5000,
  "03": 10000,
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  pageUrl: string;
  /** Sponsor's display name — labels the "Sponsor (X)" form input
   *  + surfaces in the green success card. */
  sponsorName: string;
  /** POST endpoint the modal submits to. Different per sponsor so
   *  audit trails stay clean (e.g. /api/sponsor/debbiebiery/sign).
   *  The dynamic /api/sponsor/[slug]/sign route handles them all. */
  signEndpoint: string;
  /** Sitani's pre-signed stamp date for this agreement. Each
   *  sponsor has their own preparation date so the document
   *  reads as fresh per sponsor. */
  sitaniSignedDate: string;
};

// Inline hollow-triangle arrow — same shape used across every
// chrome-flash CTA in the repo. Stroke-only via currentColor.
function HollowTriangle() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

// Inline close-X — single usage, matches the visual weight of
// the X used in every other activate modal on the site.
function CloseX() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function SignModal({
  isOpen,
  onClose,
  pageUrl,
  sponsorName,
  signEndpoint,
  sitaniSignedDate,
}: Props) {
  // Form state — tier defaults to Tier 02 because the
  // agreement copy explicitly anchors it as the
  // federation-build tier; the operator can switch any time
  // before signing. Recovery + equity-track options were
  // stripped 2026-05-25 — the offer is just pick a tier, sign,
  // get assets.
  const [tier, setTier] = useState<Tier>("02");
  const [amount, setAmount] = useState<string>("");
  const [signerName, setSignerName] = useState<string>("");
  const [signerEmail, setSignerEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<{
    name: string;
    date: string;
  } | null>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);

  // Esc-to-close + body scroll lock while modal is mounted.
  // Same recipe as the Alira / Rene pricing modals — restores
  // body overflow on unmount.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, handleClose]);

  async function onSign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signerName.trim()) {
      setError("Type your full legal name to sign.");
      return;
    }
    if (
      !signerEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())
    ) {
      setError("Enter a valid email so we can send you a copy.");
      return;
    }
    const amountNum = Number(amount.replace(/[$,]/g, ""));
    if (!amount.trim() || isNaN(amountNum)) {
      setError("Enter your contribution amount.");
      return;
    }
    const tierMin = TIER_MINIMUMS[tier];
    if (amountNum < tierMin) {
      setError(
        `Tier ${tier} minimum is $${tierMin.toLocaleString()}. Increase your contribution or pick a lower tier.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(signEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          amount: amountNum,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          pageUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Sign failed (${res.status})`);
      }
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setSigned({ name: signerName.trim(), date: today });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Execute the sponsorship agreement"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      data-testid="delhasson-sign-modal"
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950/95 p-4 sm:p-8 shadow-2xl shadow-amber-300/10 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-zinc-300 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-colors"
          data-testid="delhasson-sign-modal-close"
        >
          <CloseX />
        </button>

        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.24em] sm:tracking-[0.32em] text-amber-300/90 font-semibold">
          Execute the agreement
        </p>
        <h3
          className="mt-2 text-xl sm:text-3xl tracking-tight text-amber-100 pr-10 leading-tight"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Select your tier &amp; sign.
        </h3>

        {/* TIER SELECTOR */}
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Selected tier
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["01", "02", "03"] as Tier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                disabled={!!signed}
                className={
                  "rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors " +
                  (tier === t
                    ? "border-amber-300/80 bg-amber-300/15 text-amber-100"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-amber-300/30")
                }
              >
                Tier {t}
              </button>
            ))}
          </div>
        </div>

        {/* AMOUNT */}
        <div className="mt-5">
          <label
            htmlFor="del-amount"
            className="text-[10px] uppercase tracking-[0.28em] text-zinc-500"
          >
            Contribution amount (USD)
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3">
            <span className="text-amber-300 font-semibold">$</span>
            <input
              id="del-amount"
              type="text"
              inputMode="decimal"
              placeholder={`${TIER_MINIMUMS[tier].toLocaleString()} minimum`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!!signed}
              className="flex-1 bg-transparent text-amber-100 text-lg tabular-nums placeholder:text-zinc-700 outline-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* Recovery + Equity option pills removed 2026-05-25 per
            Sita — the offer is just pick a tier, sign, get
            assets. Form goes from 6 fields to 4. */}

        {/* SITANI'S PRE-SIGNED STAMP + signer input */}
        <div className="mt-8 grid sm:grid-cols-2 gap-5 pt-6 border-t border-amber-300/15">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
              Sponsor ({sponsorName})
            </p>
            <form onSubmit={onSign} className="mt-2 space-y-3">
              <input
                type="text"
                placeholder="Type your full legal name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={!!signed}
                className="w-full rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3 text-amber-100 placeholder:text-zinc-700 outline-none focus:border-amber-300/70 disabled:opacity-60"
                style={{
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 22,
                }}
              />
              <input
                type="email"
                placeholder="your.email@example.com"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                disabled={!!signed}
                autoComplete="email"
                className="w-full rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3 text-amber-100 placeholder:text-zinc-700 outline-none focus:border-amber-300/70 disabled:opacity-60 text-sm"
              />
              {signed ? (
                <p className="text-xs text-amber-300/80">
                  Signed {signed.date} · copy sent to your inbox
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  Typing your name and clicking &ldquo;Sign agreement&rdquo;
                  constitutes an electronic signature. We&apos;ll email you
                  a copy of the executed terms.
                </p>
              )}
            </form>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
              Pre-signed · Sitani Mafi (Interlinked)
            </p>
            <div className="mt-2 rounded-xl border border-amber-300/40 bg-amber-300/[0.06] px-4 py-3">
              <p
                className="text-amber-100"
                style={{
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 26,
                  lineHeight: 1.1,
                }}
              >
                Sitani Mafi
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
                Signed {sitaniSignedDate}
              </p>
            </div>
          </div>
        </div>

        {/* SUBMIT */}
        {!signed && (
          <div className="mt-8">
            {error && (
              <p className="mb-3 text-sm text-red-400">{error}</p>
            )}
            <button
              type="button"
              onClick={onSign}
              disabled={submitting}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 disabled:opacity-50 disabled:cursor-not-allowed px-8 sm:px-12 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
              data-testid="delhasson-sign"
            >
              <span className="chrome-white">
                {submitting ? "Signing…" : "Sign agreement"}
              </span>
              {!submitting && <HollowTriangle />}
            </button>
            <p className="mt-3 text-[11px] text-zinc-600">
              AES-256 bit Advanced Encryption · Sitani Mafi will
              countersign final paperwork after submission.
            </p>
          </div>
        )}

        {signed && (
          <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-300 font-semibold">
              Agreement executed
            </p>
            <p className="mt-2 text-sm text-zinc-200">
              Thank you, <strong>{signed.name}</strong>. Sitani has been
              notified of your selected tier and will follow up within 24
              hours with the definitive agreement and onboarding next
              steps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// OptionPill helper removed 2026-05-25 — was only used by the
// recovery + equity-track pill groups that got stripped in the
// same edit. Re-add if any future form clause wants the same
// pill style.
