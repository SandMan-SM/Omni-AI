"use client";

// SponsorRotation — canonical 3-card cross-portfolio block that
// ships on every federation site's newsletter. CPS featured, Fred
// Circle in slot 2, Live Better OTD in slot 3. Visual treatment is
// theme-tokenized via CSS variables (--gold, --line, --background,
// --foreground, --silver, --silver-soft, --silver-deep, --void-2)
// so each host site can re-skin it by setting those tokens in their
// own globals.css. Falls back to amber/zinc Tailwind colors when the
// CSS variables aren't defined.
//
// Each click pings the Omni Leads analytics endpoint with the
// sponsor + slot + host so we can see which sites' newsletters are
// actually moving cross-portfolio attention.
//
// The data lives in `lib/federation-sponsors.ts` — a single source
// of truth. Sibling federation repos hand-sync this same component
// (with their own theme tokens) so changing a sponsor's URL or copy
// requires one edit here + a copy-paste sweep, not a per-site
// rewrite.

import Link from "next/link";
import {
  buildSponsorHref,
  slotsForHost,
  type SponsorSlot,
} from "@/lib/federation-sponsors";

// Inline SVG icons (Sparkles + ArrowUpRight from the lucide set) so
// this component has zero peer-dependency requirements. Cross-repo
// deployment was failing on sites without lucide-react installed.
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx={4} cy={20} r={2} />
    </svg>
  );
}

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(host: string, sponsor: string, rank: number) {
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/omnileads/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: "sponsor_click",
        event_category: "federation",
        action: "click",
        target_id: sponsor,
        target_type: "federation_sponsor",
        page_url:
          typeof window !== "undefined" ? window.location.href : null,
        properties: { host, sponsor, slot: rank },
      }),
    }).catch(() => {});
  } catch {
    /* fail open */
  }
}

type Props = {
  /**
   * Slug of the site this rotation is being rendered on
   * (e.g. "rene-laveau", "cps", "alira"). Stamped into every sponsor
   * URL as `?ref=<host>` and logged with each click event for
   * cross-portfolio attribution.
   */
  host: string;
  /**
   * Optional eyebrow override. Defaults to "The Interlinked thread".
   */
  eyebrow?: string;
  /**
   * Optional intro paragraph override.
   */
  intro?: string;
};

const DEFAULT_INTRO =
  "Three operators ride on every dispatch — chosen because their work sits on the same line. Each one is doing the repair-work the Society talks about, in a different room.";

export default function SponsorRotation({
  host,
  eyebrow = "The Interlinked thread",
  intro = DEFAULT_INTRO,
}: Props) {
  return (
    <aside
      aria-label="Cross-portfolio sponsors"
      data-track-area="federation-sponsors"
      data-host={host}
      className="my-12 rounded-md border border-[var(--line,theme(colors.zinc.800))] bg-[var(--void-2,theme(colors.zinc.950))]/60 p-6 sm:p-8"
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[0.6rem] tracking-[0.32em] uppercase text-[var(--gold,theme(colors.amber.400))]">
          <SparklesIcon className="h-3.5 w-3.5" />
          <span>{eyebrow}</span>
        </div>
        <Link
          href={`https://omnileadsagi.com/manifesto?ref=${encodeURIComponent(host)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.6rem] tracking-[0.32em] uppercase text-[var(--silver-soft,theme(colors.zinc.400))] transition hover:text-[var(--gold,theme(colors.amber.300))]"
        >
          Read the manifesto →
        </Link>
      </header>

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[var(--silver,theme(colors.zinc.300))]">
        {intro}
      </p>

      <ul className="grid gap-3 sm:grid-cols-3">
        {slotsForHost(host).map((s) => (
          <SponsorCard key={s.slug} slot={s} host={host} />
        ))}
      </ul>

      <p className="mt-6 text-center text-[0.55rem] tracking-[0.32em] uppercase text-[var(--silver-deep,theme(colors.zinc.500))]">
        Sponsored slots are chosen by the operator, not by the algorithm.
      </p>
    </aside>
  );
}

function SponsorCard({ slot: s, host }: { slot: SponsorSlot; host: string }) {
  const href = buildSponsorHref(s, host);
  return (
    <li>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => ping(host, s.brand, s.rank)}
        data-track={`sponsor-${s.rank}`}
        data-track-area={`sponsor-${host}`}
        className="group flex h-full flex-col rounded-md border border-[var(--line,theme(colors.zinc.800))] bg-[var(--background,theme(colors.zinc.900))] p-4 transition hover:-translate-y-0.5 hover:border-[var(--gold,theme(colors.amber.400))]/60"
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className={
              s.rank === 1
                ? "rounded-full bg-[var(--gold,theme(colors.amber.400))]/15 px-2 py-0.5 text-[0.55rem] tracking-[0.32em] uppercase text-[var(--gold,theme(colors.amber.300))]"
                : "rounded-full border border-[var(--line,theme(colors.zinc.800))] px-2 py-0.5 text-[0.55rem] tracking-[0.32em] uppercase text-[var(--silver-soft,theme(colors.zinc.400))]"
            }
          >
            {s.badge}
          </span>
          <ArrowUpRightIcon className="h-3.5 w-3.5 text-[var(--silver-deep,theme(colors.zinc.500))] transition group-hover:text-[var(--gold,theme(colors.amber.300))]" />
        </div>
        <p className="font-semibold text-base text-[var(--foreground,theme(colors.zinc.100))] transition group-hover:text-[var(--gold,theme(colors.amber.300))]">
          {s.brand}
        </p>
        <p className="mt-1 text-[0.65rem] italic text-[var(--silver-soft,theme(colors.zinc.400))]">
          {s.tagline}
        </p>
        <p className="mt-3 text-[0.78rem] leading-relaxed text-[var(--silver-soft,theme(colors.zinc.400))]">
          {s.blurb}
        </p>
      </Link>
    </li>
  );
}
