"use client";

// SolutionsClient — à la carte services catalog. Same cinematic system
// as /meta: hoisted ProposalBackdrop + GoldSparksBackdrop siblings,
// amber palette, Georgia serif headlines, chrome-flash CTA.
//
// Every card renders the PayPal "Debit or Credit Card" button DIRECTLY
// (PayPalOrderButton) — one-time card checkout, no Subscribe widget, no
// intermediate "Pay by Card" trigger or modal. Data comes from
// lib/solutions.ts (single source of truth).

import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";
import { PayPalOrderButton } from "@/components/paypal-order-button";
import { BOOK_CALL_URL, type Solution } from "@/lib/solutions";

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

type Props = {
  pageUrl: string;
  paypalClientId: string;
  websiteTiers: Solution[];
  solutions: Solution[];
};

function PriceTag({ sol }: { sol: Solution }) {
  const isMonthly = sol.billing === "monthly";
  const [main, suffix] = isMonthly ? sol.price.split("/") : [sol.price, ""];
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-4xl sm:text-5xl text-amber-300 leading-none"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {main}
      </span>
      {suffix ? <span className="text-sm text-zinc-400">/{suffix}</span> : null}
    </div>
  );
}

function ServiceCard({
  sol,
  clientId,
  featured = false,
  payFunding = "card",
}: {
  sol: Solution;
  clientId: string;
  featured?: boolean;
  payFunding?: "card" | "paypal";
}) {
  return (
    <div
      className={
        "relative flex flex-col overflow-hidden rounded-3xl border p-6 sm:p-7 " +
        (featured
          ? "border-amber-300/40 bg-gradient-to-br from-amber-300/[0.08] via-amber-300/[0.02] to-transparent"
          : "border-white/10 bg-white/[0.02]")
      }
    >
      {featured ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-amber-300/20 blur-3xl"
        />
      ) : null}
      <div className="relative z-10 flex flex-col grow">
        {sol.kind ? (
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80">
            {sol.kind}
          </p>
        ) : null}
        <h3
          className="mt-2 text-2xl tracking-tight text-white"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {sol.name}
        </h3>
        <div className="mt-4">
          <PriceTag sol={sol} />
        </div>
        <p className="mt-4 text-sm text-zinc-400 leading-relaxed">{sol.blurb}</p>
        <ul className="mt-5 space-y-2.5">
          {sol.bullets.map((b) => (
            <li key={b} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
              <span className="mt-0.5 text-amber-300" aria-hidden>
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          {sol.amount ? (
            <div className="mt-6">
              <PayPalOrderButton
                clientId={clientId}
                amount={sol.amount}
                label={sol.name}
                funding={payFunding}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SolutionsClient({
  pageUrl,
  paypalClientId,
  websiteTiers,
  solutions,
}: Props) {
  // Group by billing type: one-time builds together, monthly services
  // together. AI CEO is its own feature band.
  const aiCeo = solutions.find((s) => s.key === "ai-ceo");
  const oneTimeExtras = solutions.filter(
    (s) => s.key !== "ai-ceo" && s.billing === "once",
  );
  const monthly = solutions.filter((s) => s.billing === "monthly");
  const builds = [...websiteTiers, ...oneTimeExtras];

  return (
    <>
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 overflow-hidden proposal-page">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-14">
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
              AI Integrated Solutions
            </p>
            <h1
              className="mt-5 text-5xl sm:text-7xl tracking-tight leading-[1.02]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Pay only for what you{" "}
              <span className="text-amber-300">need</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl text-zinc-300 leading-relaxed">
              Every AI capability, available on its own. Buy a build
              outright or subscribe to a managed service — each one checks
              out in a tap by debit or credit card. No bundles, no lock-in.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
              <span>✓ One-time builds or monthly retainers</span>
              <span>✓ Secure debit/credit checkout</span>
              <span>✓ Mix and match anything</span>
            </div>
            <div className="mt-8">
              <Link
                href={BOOK_CALL_URL}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-8 py-4 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
              >
                <span className="chrome-white">Book Free Consultation</span>
                <HollowTriangle />
              </Link>
            </div>
          </div>
        </section>

        {/* BUILDS — websites + one-time builds */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Build it once · own it
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Websites &amp; one-time builds.
            </h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {builds.map((t) => (
                <ServiceCard
                  key={t.key}
                  sol={t}
                  clientId={paypalClientId}
                  featured={t.featured}
                />
              ))}
            </div>
          </div>
        </section>

        {/* AI CEO — feature band */}
        {aiCeo ? (
          <section className="relative border-t border-white/5 bg-black/40">
            <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
              <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
                Flagship
              </p>
              <div className="mt-6 relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-300/[0.08] via-amber-300/[0.02] to-transparent p-7 sm:p-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
                />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:items-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80">
                      {aiCeo.kind}
                    </p>
                    <h3
                      className="mt-2 text-4xl sm:text-5xl tracking-tight"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {aiCeo.name}
                    </h3>
                    <p className="mt-4 max-w-xl text-base text-zinc-300 leading-relaxed">
                      {aiCeo.blurb}
                    </p>
                    <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                      {aiCeo.bullets.map((b) => (
                        <li key={b} className="flex gap-2.5 text-sm text-zinc-300 leading-snug">
                          <span className="mt-0.5 text-amber-300" aria-hidden>
                            ✓
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:justify-self-end w-full lg:max-w-xs">
                    <div className="rounded-2xl border border-amber-300/30 bg-black/30 p-6 backdrop-blur-sm">
                      <PriceTag sol={aiCeo} />
                      <p className="mt-2 text-sm text-zinc-400">
                        Custom build · scoped to your operation.
                      </p>
                      {aiCeo.amount ? (
                        <div className="mt-6">
                          <PayPalOrderButton
                            clientId={paypalClientId}
                            amount={aiCeo.amount}
                            label={aiCeo.name}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* MONTHLY MANAGED SERVICES */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
            <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">
              Monthly managed services
            </p>
            <h2
              className="mt-3 text-3xl sm:text-4xl tracking-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Add what you need.
            </h2>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthly.map((s) => (
                <ServiceCard
                  key={s.key}
                  sol={s}
                  clientId={paypalClientId}
                  payFunding="paypal"
                />
              ))}
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="relative border-t border-white/5 bg-black/40">
          <div className="mx-auto max-w-6xl px-6 py-10 text-center">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Secure checkout via PayPal · AES-256 encryption · cancel any
              subscription anytime after month one.
            </p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/[0.05] via-amber-300/[0.02] to-transparent p-8 sm:p-12 text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl"
              />
              <p className="relative z-10 text-[11px] uppercase tracking-[0.4em] text-amber-300/90 font-semibold">
                Not sure where to start?
              </p>
              <h2
                className="relative z-10 mt-3 text-3xl sm:text-5xl tracking-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Let&apos;s map the right stack for you.
              </h2>
              <p className="relative z-10 mt-4 max-w-xl mx-auto text-sm sm:text-base text-zinc-400 leading-relaxed">
                Book a free consultation and we&apos;ll scope exactly which
                services move your numbers — then you pay for only those.
              </p>
              <div className="relative z-10 mt-8 flex justify-center">
                <Link
                  href={BOOK_CALL_URL}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-amber-300/20 hover:bg-amber-300/30 px-10 py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-amber-300/20 backdrop-blur-sm"
                >
                  <span className="chrome-white">Book Free Consultation</span>
                  <HollowTriangle />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 relative mt-8">
          <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-zinc-700 text-center">
            <Link href="/" className="hover:text-amber-300">
              omnileadsagi.com
            </Link>
          </div>
        </footer>
        <p className="sr-only">{pageUrl}</p>
      </div>
    </>
  );
}
