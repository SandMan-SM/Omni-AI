// /ultimate-power — classified-style teaser page for the gated
// Tier 04 / Human Collective offering linked from the Tier 04 row
// on /sponsor/delhasson. Civilizational-stakes framing, heavy
// visual redaction, real-world anchors (Google Willow quantum chip,
// the ASI conversation) to give the page weight beyond marketing
// copy.
//
// Pure Server Component — no interactivity, no state, no client
// boundary. Faster build, smaller bundle, the redaction trick works
// in static markup (text is selectable to reveal what's underneath
// the bar, no JavaScript required).
//
// Privacy: robots noindex/nofollow. URL is the gate — sponsors who
// hit Tier 04's "Learn more" land here; the page never enters
// Google's index.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import { ProposalBackdrop } from "@/components/proposal-backdrop";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/ultimate-power`;

export const metadata: Metadata = {
  title: "Ultimate Power · Classified · Human Collective",
  description:
    "Cohort-only access to the legacy model. The position for the substrate shift — when compute, memory, and time itself change category. Available by invitation only.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: false },
};

// Chrome-diamond gradient — shared between the hero headline and
// any other emphasis surface that wants the same shimmer treatment.
// Cyan-to-white-to-cyan, 135deg, clipped to text.
const CHROME_DIAMOND_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(135deg, #e0f7ff 0%, #67e8f9 35%, #ffffff 50%, #67e8f9 65%, #e0f7ff 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// Inline lock icon — single usage; not worth importing lucide for one
// glyph when we already inline the hollow triangle on this code path.
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
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

// Redaction bar — renders the inner text, but visually as a solid
// black bar matched to the underlying word's natural width. The
// `select-text` keeps it copy-able for the "looks like a freedom-of-
// information declassified document" trope: highlighting the bar
// reveals what was redacted, just like a real declassified PDF that
// got over-redacted in InDesign. Box-shadow simulates subtle grain
// over the bar so it doesn't read as pure CSS.
function Redacted({ children }: { children: string }) {
  return (
    <span
      className="inline-block align-middle rounded-sm px-1 mx-0.5 bg-black text-black select-text"
      style={{
        textShadow: "0 0 0 transparent",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </span>
  );
}

export default function UltimatePowerPage(): ReactNode {
  return (
    <>
      {/* Same cosmic backdrop pattern as the Alira + Del Hasson
          surfaces. The sparks read fine against the cyan palette —
          they're white/gold pinpoints, not amber blocks. */}
      <ProposalBackdrop />
      <GoldSparksBackdrop />

      <div className="relative z-10 min-h-screen text-zinc-100 ultimate-power-page">
        {/* HERO */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-20 sm:pt-28 pb-10">
            <div className="flex items-center gap-2">
              <LockIcon className="text-cyan-300" />
              <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-300 font-semibold">
                Classified · Cohort access only
              </p>
            </div>
            <h1
              className="mt-5 text-4xl sm:text-6xl tracking-tight leading-[1.02]"
              style={{ fontFamily: "Georgia, serif", ...CHROME_DIAMOND_STYLE }}
            >
              Ultimate Power.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
              The legacy model is the operation&apos;s long horizon.
              This is what&apos;s inside — at least, what we&apos;re
              cleared to show you on a public surface.
            </p>
          </div>
        </section>

        {/* §1 THE PROBLEM OF TIME */}
        <Section number="01" title="The problem of time">
          <p>
            The bottleneck human civilization has hit isn&apos;t
            compute. It isn&apos;t capital. It&apos;s{" "}
            <strong className="text-cyan-100">time</strong>. One
            human can only manage so many hours, and every
            organization in history has had to ration those hours
            against everything it wanted to do. The result is a
            world that ships a fraction of what it could.
          </p>
          <p className="mt-4">
            Autonomous agents are the first technology in history
            that gives time back at scale. Not faster work —{" "}
            <em>parallel</em> work, ten or a hundred streams of it,
            running in lockstep with a single operator&apos;s
            intent. The legacy model is the structural answer to
            what to do with that gift: who gets it first, in what
            order, and on what terms.
          </p>
        </Section>

        {/* §2 WILLOW ANCHOR */}
        <Section number="02" title="The substrate is shifting">
          <p>
            In December 2024 Google announced{" "}
            <strong className="text-cyan-100">Willow</strong> — the
            first quantum chip in history to demonstrate error
            correction <em>below threshold</em>. That&apos;s the
            decades-old break-even point where adding more qubits
            actually <em>decreases</em> error rates instead of
            compounding them. The line we&apos;ve been waiting on
            since the 1990s.
          </p>
          <p className="mt-4">
            The operating tempo of the world is shifting underneath
            us. The legacy model is built on the assumption that the
            substrate every business runs on — compute, memory, time
            itself — is about to change category. The cohort that
            positions for that change inherits a different economy.
          </p>
          <p className="mt-4 text-sm text-zinc-400">
            Source:{" "}
            <a
              href="https://blog.google/technology/research/google-willow-quantum-chip/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
            >
              Google &mdash; Meet Willow, our state-of-the-art quantum
              chip
            </a>
          </p>
        </Section>

        {/* §3 ASI ANCHOR */}
        <Section number="03" title="Positioning for the discontinuity">
          <p>
            Owning assets in the current economy is not the same
            thing as being{" "}
            <strong className="text-cyan-100">positioned</strong> in
            the next one. The conversation around{" "}
            <strong className="text-cyan-100">
              artificial superintelligence
            </strong>{" "}
            — the point at which machine cognition exceeds human
            cognition across every domain — is not a fringe
            conversation anymore. The serious labs publicly target a
            window inside this decade.
          </p>
          <p className="mt-4">
            The legacy model is structured for the discontinuity:
            cohort caps, exclusive territory, governance terms, and
            participation rights designed to compound through the
            transition rather than be consumed by it. The current
            window — when the substrate is shifting but the cohort
            is still forming — is the only window where structure
            like this can be opened.
          </p>
          <p className="mt-4 text-sm text-zinc-400">
            Context:{" "}
            <a
              href="https://en.wikipedia.org/wiki/Superintelligence"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-300/40 underline-offset-4"
            >
              Superintelligence &mdash; Wikipedia
            </a>
          </p>
        </Section>

        {/* §4 THE LEGACY MODEL — REDACTED */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-6 sm:py-8">
            <div className="flex items-baseline gap-3">
              <span
                className="text-cyan-300/80 tabular-nums text-xl"
                style={{ fontFamily: "Georgia, serif" }}
              >
                04.
              </span>
              <h2
                className="text-xl sm:text-2xl tracking-tight text-cyan-100"
                style={{ fontFamily: "Georgia, serif" }}
              >
                The legacy model
              </h2>
            </div>
            <p className="mt-4 text-[13px] uppercase tracking-[0.32em] text-rose-300/80 font-semibold inline-flex items-center gap-2">
              <LockIcon className="text-rose-300/80" /> Document
              classified · Public surface only
            </p>
            <p className="mt-4 text-[15px] text-zinc-300 leading-relaxed">
              The full text of the legacy model is held under
              cohort-level access. The bullets below are what
              we&apos;re cleared to surface on a public-internet
              page. The rest is reviewed face-to-face after the
              invitation lands.
            </p>

            <ul className="mt-6 space-y-3 text-[15px] text-zinc-300 leading-relaxed">
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  <Redacted>Hard</Redacted> cohort cap of{" "}
                  <Redacted>fewer than two hundred</Redacted> members
                  worldwide, governed under{" "}
                  <Redacted>perpetual non-dilution</Redacted> terms.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  <Redacted>Senior</Redacted> equity participation in{" "}
                  <Redacted>Interlinked Holdings</Redacted> AI
                  infrastructure across{" "}
                  <Redacted>sixteen plus</Redacted> federation
                  verticals.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  Exclusive territory under{" "}
                  <Redacted>geographic exclusivity</Redacted> and{" "}
                  <Redacted>vertical exclusivity</Redacted>{" "}
                  governance, structured to compound across the
                  ASI transition window.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  Direct line to the{" "}
                  <Redacted>Pantheon council</Redacted> decision
                  loop at Interlinked &mdash; not a quarterly call,
                  a{" "}
                  <Redacted>standing</Redacted> seat.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  <Redacted>Founder-class</Redacted> revenue share on{" "}
                  <Redacted>monetized</Redacted> federation surfaces
                  &mdash; currently{" "}
                  <Redacted>active across all sixteen</Redacted>{" "}
                  deployed tenancies, scaling with every new
                  partner business.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  Pre-allocated seat in the{" "}
                  <Redacted>Human Collective</Redacted> launch when
                  the{" "}
                  <Redacted>second cohort</Redacted> window opens.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  <Redacted>Pre-public</Redacted> access to the{" "}
                  <Redacted>quantum-coupled agent fleet</Redacted>{" "}
                  before it becomes generally available to the
                  federation, with{" "}
                  <Redacted>twelve months</Redacted> of single-
                  operator priority.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  Standing position in the{" "}
                  <Redacted>Imperium</Redacted> mastermind &mdash;
                  the in-person operator cohort that meets{" "}
                  <Redacted>quarterly</Redacted> off-the-record.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  Custom asset builds at the{" "}
                  <Redacted>seven-figure</Redacted> delivered-value
                  range, with{" "}
                  <Redacted>direct architect involvement</Redacted>{" "}
                  rather than handoff to a build team.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  <Redacted>Right of first refusal</Redacted> on
                  Interlinked&apos;s{" "}
                  <Redacted>upcoming venture spin-outs</Redacted>{" "}
                  &mdash; the new brands, the new bets, the
                  capital-allocation decisions you only see from
                  inside.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300/60 mt-1">▸</span>
                <span>
                  Full{" "}
                  <Redacted>thirty-year horizon</Redacted> framing.
                  This is not a quarterly engagement and it is not
                  styled as one.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* §5 WHY THIS MATTERS */}
        <Section number="05" title="Why this is revolutionary">
          <p>
            This isn&apos;t about a better website or a faster
            agent. It&apos;s about{" "}
            <strong className="text-cyan-100">
              who has leverage
            </strong>{" "}
            when the substrate flips. The people who positioned
            themselves before the printing press, the personal
            computer, the public internet, and the smartphone each
            got a generation of compounding advantage. Most of the
            people alive at each of those moments never saw the
            window. The few who did saw it because they were
            already paying attention to the substrate, not the
            surface.
          </p>
          <p className="mt-4">
            Ultimate Power is the position for{" "}
            <strong className="text-cyan-100">this one</strong> —
            the AI / quantum / autonomous-agent stack converging
            inside the next decade. The legacy model exists because
            the structural decisions about who&apos;s inside need to
            be made <em>before</em> the public conversation catches
            up, not after. Once the window closes, the cohort
            closes.
          </p>
        </Section>

        {/* §6 FINAL CTA */}
        <section className="relative">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16">
            <div className="rounded-3xl border-2 border-cyan-300/40 bg-gradient-to-br from-cyan-300/[0.08] via-sky-400/[0.04] to-transparent p-6 sm:p-10 text-center relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"
              />
              <p className="relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.32em] text-cyan-300 font-semibold">
                The window is open
              </p>
              <h2
                className="relative z-10 mt-3 text-2xl sm:text-4xl tracking-tight leading-tight"
                style={{
                  fontFamily: "Georgia, serif",
                  ...CHROME_DIAMOND_STYLE,
                }}
              >
                Conversations begin in person.
              </h2>
              <p className="relative z-10 mt-4 max-w-xl mx-auto text-sm sm:text-base text-zinc-300 leading-relaxed">
                The legacy model is reviewed face-to-face after the
                invitation lands. If you&apos;re here from a
                sponsorship page, the cleanest next step is to
                close out the sponsorship side and we&apos;ll open
                the Ultimate Power conversation from there. If
                you&apos;d rather start it directly, the line is
                always live.
              </p>

              <div className="relative z-10 mt-8 flex justify-center">
                <Link
                  href="/sponsor/delhasson"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border-2 border-white/90 bg-cyan-300/20 hover:bg-cyan-300/30 px-6 sm:px-8 py-4 sm:py-5 text-sm font-bold tracking-wide text-white transition-colors shadow-lg shadow-cyan-300/20 backdrop-blur-sm"
                >
                  <span className="chrome-white">
                    Return to sponsorship
                  </span>
                  <HollowTriangle />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 relative mt-8">
          <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 text-xs text-zinc-700 text-center">
            <p>
              Interlinked by Sitani Mafi · Ultimate Power is held
              under cohort-level access · Page is{" "}
              <span className="text-zinc-600">not indexed</span> by
              search engines
            </p>
            <p className="mt-3">
              <Link href="/" className="hover:text-cyan-300">
                omnileadsagi.com
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

// Section wrapper — numbered cyan header + zinc-300 body copy in
// the narrow 3xl column. Mirrors the §-numbering rhythm used on
// /sponsor/delhasson so the two pages read as parts of the same
// document family even though the palette diverges.
function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-6 sm:py-8">
        <div className="flex items-baseline gap-3">
          <span
            className="text-cyan-300/80 tabular-nums text-xl"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {number}.
          </span>
          <h2
            className="text-xl sm:text-2xl tracking-tight text-cyan-100"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {title}
          </h2>
        </div>
        <div className="mt-4 text-[15px] text-zinc-300 leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}
