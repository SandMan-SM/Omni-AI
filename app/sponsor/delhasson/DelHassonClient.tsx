"use client";

// DelHassonClient — 7-second teaser surface for the Del Hasson
// sponsorship agreement. Was the 1200-LOC long-form page; the
// full breakdown (§1–§8 sections + savings chart + LB/Alira
// proof cards + Hasson Enterprises hook) now lives at
// /sponsor/delhasson/info — this teaser routes there via the
// Learn more CTA.
//
// Three Activate Sponsorship buttons (hero / mid / footer) all
// open the same shared SignModal (popup form). The inline sign
// block that used to sit at the bottom of the page is gone —
// the form only renders when the operator commits to the action.
//
// Backdrop pattern: ProposalBackdrop + GoldSparksBackdrop as
// Fragment-level siblings so fixed -z layers don't get eaten by
// the wrapper's compositing context. Same rule used on every
// other proposal / referral / contract surface.

import { useState } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { SignModal } from "./SignModal";

type Props = {
  pageUrl: string;
};

// Inline hollow-triangle arrow — same recipe used across every
// chrome-flash CTA in the repo.
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

// Inline padlock — used by the AES-256 trust strip + the
// locked-tier Tier 04 card eyebrow.
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// AES-256 trust strip — reused under every Activate Sponsorship
// CTA on the page so the encryption signal lands at every
// commit moment.
function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <p
      className={
        "inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-amber-300/90 font-semibold " +
        className
      }
    >
      <LockIcon />
      AES-256 bit Advanced Encryption
    </p>
  );
}

// Activate Sponsorship chrome-flash button — reused in 3
// placements (hero / mid / footer CTA card) per Sita. All three
// open the shared SignModal.
function ActivateButton({
  onClick,
  testId,
}: {
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
      data-testid={testId}
    >
      <span className="chrome-white">Activate Sponsorship</span>
      <HollowTriangle />
    </button>
  );
}

export function DelHassonClient({ pageUrl }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <>
      {/* Cinematic backdrop hoisted to Fragment-level siblings */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 delhasson-sponsor-page">
        {/* HERO — eyebrow + serif title + one-line pitch + dual
            CTAs. Activate Sponsorship #1 of 3. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 pt-20 sm:pt-28 pb-10 sm:pb-14">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80 font-semibold">
              Interlinked · by Sitani Mafi · Sponsorship
            </p>
            <h1
              className="mt-5 text-4xl sm:text-6xl tracking-tight leading-[1.05] text-amber-200/95"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Prepared for Del Hasson.
            </h1>
            <p className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed">
              A 4-tier sponsorship + digital-asset build agreement
              delivering up to{" "}
              <span className="text-amber-100 font-semibold tabular-nums">
                $100K+
              </span>{" "}
              in owned digital assets. Hasson Enterprises personal-
              brand build included as part of the legacy model.
              Pre-signed by Sitani Mafi.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <ActivateButton
                onClick={openModal}
                testId="delhasson-activate-hero"
              />
              <Link
                href="/sponsor/delhasson/info"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.04] hover:bg-amber-300/[0.10] px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold tracking-wide text-amber-200 transition-colors backdrop-blur-sm"
                data-testid="delhasson-learn-more-hero"
              >
                Learn more
              </Link>
            </div>

            <div className="mt-5">
              <TrustStrip />
            </div>
          </div>
        </section>

        {/* SCOPE STRIP — flipped from delivered-asset values
            ($25K / $50K / $100K) to entry contribution ranges
            (starting at $1K) per Sita. The big values were reading
            as asking prices — "Tier 01 · Assets · $25K" looked
            like Del had to pay $25K to enter Tier 01, which was
            the opposite of the intent. Showing the contribution
            entry ("Tier 01 starts at $1K") keeps the teaser
            approachable. The full delivered-value math + "you
            walk away with up to $100K in assets" framing stays
            on /info where it's contextualized properly. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 pb-10 sm:pb-12">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              How to enter
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { value: "$1K+", label: "Tier 01 · Entry" },
                { value: "$5K+", label: "Tier 02 · Entry" },
                { value: "$10K+", label: "Tier 03 · Entry" },
                { value: "🔒", label: "Tier 04 · Locked" },
                { value: "∞", label: "Potential" },
              ].map((stat) => {
                const isBig =
                  stat.value === "∞" || stat.value === "🔒";
                return (
                  <div
                    key={stat.label}
                    className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/[0.04] px-3 py-6 text-center [&:nth-child(5)]:col-span-2 sm:[&:nth-child(5)]:col-span-1"
                  >
                    <p
                      className={
                        (isBig
                          ? "text-5xl sm:text-6xl"
                          : "text-3xl sm:text-4xl") +
                        " tabular-nums text-amber-300 leading-none"
                      }
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {stat.value}
                    </p>
                    <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {/* Small reassurance line under the strip so the
                contribution-as-entry framing reads correctly even
                without anyone reading the /info breakdown. */}
            <p className="mt-4 text-center text-xs text-zinc-500">
              Entry is what you contribute. The build values you{" "}
              <em>walk away with</em> scale from{" "}
              <span className="text-amber-200 tabular-nums">$25K</span>{" "}
              up to{" "}
              <span className="text-amber-200 tabular-nums">$100K+</span>{" "}
              in owned digital assets — see{" "}
              <Link
                href="/sponsor/delhasson/info"
                className="text-amber-300 hover:text-amber-200 underline decoration-amber-300/40 underline-offset-4"
              >
                full breakdown
              </Link>
              .
            </p>
          </div>
        </section>

        {/* PROOF strip — compressed from §6 of the full breakdown. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 py-6 sm:py-8">
            <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Proof
              </p>
              <p className="mt-3 text-[15px] text-zinc-300 leading-relaxed">
                Interlinked runs a{" "}
                <span className="text-amber-100 font-semibold tabular-nums">
                  $350K+
                </span>{" "}
                live federation portfolio — including the Live
                Better On The Drip podcast (powering autonomous
                lead-response + booking at Prime IV Sandy) and
                Alira, the federation reference build. In
                production, clients see lost-lead recovery
                approaching{" "}
                <span className="text-amber-100 font-semibold">
                  70%
                </span>{" "}
                inside the first month. The full breakdown lives
                under <Link href="/sponsor/delhasson/info" className="text-amber-300 hover:text-amber-200 underline decoration-amber-300/40 underline-offset-4">Learn more</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* MID Activate Sponsorship CTA — solo button so Del has a
            commitment path mid-page. Activate #2 of 3. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 py-4 sm:py-6 flex flex-col items-center gap-4">
            <ActivateButton
              onClick={openModal}
              testId="delhasson-activate-mid"
            />
            <TrustStrip />
          </div>
        </section>

        {/* TIER 04 LOCKED CARD — visual hook for what's behind the
            curtain. Non-interactive lock pill (no href, no
            onClick) per Sita's earlier spec. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 py-6 sm:py-8">
            <div className="rounded-2xl border-2 border-cyan-300/50 bg-gradient-to-br from-cyan-300/[0.08] via-sky-400/[0.04] to-transparent p-5 sm:p-6 relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl"
              />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <LockIcon className="text-cyan-200" />
                    <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300 font-semibold">
                      Tier 04 · Locked
                    </p>
                  </div>
                  <h3
                    className="mt-2 text-2xl sm:text-3xl leading-tight"
                    style={{
                      fontFamily: "Georgia, serif",
                      background:
                        "linear-gradient(135deg, #e0f7ff 0%, #67e8f9 35%, #ffffff 50%, #67e8f9 65%, #e0f7ff 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    Ultimate Power.
                  </h3>
                  <p className="mt-3 text-[14px] text-zinc-300 leading-relaxed max-w-2xl">
                    Bespoke commitments above the federation cap.
                    Custom asset builds, exclusive territory, and
                    partnership terms structured one-on-one.{" "}
                    <span className="text-cyan-200/90 italic">
                      Details available by invitation only.
                    </span>
                  </p>
                </div>
                <div
                  role="presentation"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-white/90 bg-cyan-300/20 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-cyan-300/20 backdrop-blur-sm cursor-default select-none"
                  aria-label="Tier 04 is locked"
                >
                  <span className="chrome-white">Locked</span>
                  <LockIcon />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER CTA card — Activate #3 of 3. */}
        <section className="relative">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-16">
            <div className="rounded-3xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-5 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-amber-300/90 font-semibold">
                Ready when you are
              </p>
              <h2
                className="relative z-10 mt-2 text-2xl sm:text-4xl tracking-tight leading-tight text-amber-200/95"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Pick your tier &amp; lock in the build.
              </h2>
              <p className="relative z-10 mt-3 max-w-xl mx-auto text-[13px] sm:text-sm text-zinc-400 leading-relaxed">
                Click below to open the agreement, select your tier,
                and sign. Sitani has already counter-signed —
                you&apos;re finishing the document, not starting one.
              </p>
              <div className="relative z-10 mt-6 sm:mt-8 flex justify-center">
                <ActivateButton
                  onClick={openModal}
                  testId="delhasson-activate-footer"
                />
              </div>
              <div className="relative z-10 mt-6 flex justify-center">
                <TrustStrip />
              </div>
            </div>
          </div>
        </section>

        {/* SITE FOOTER */}
        <footer className="border-t border-white/5 relative mt-4">
          <div className="mx-auto max-w-5xl px-5 sm:px-8 py-8 text-xs text-zinc-700 text-center">
            <Link href="/" className="hover:text-amber-300">
              omnileadsagi.com · Interlinked by Sitani Mafi
            </Link>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>

      <SignModal
        isOpen={modalOpen}
        onClose={closeModal}
        pageUrl={pageUrl}
      />
    </>
  );
}
