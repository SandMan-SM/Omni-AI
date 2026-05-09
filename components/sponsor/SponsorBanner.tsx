// Slim sponsor banner — single line, host-adapting. Mirrors the
// /embed/sponsor.js banner shape so server-rendered surfaces (e.g.
// newsletter post pages) and client-embedded surfaces (every Realm I
// site) read as one consistent ad placement.
//
// Heavy three-card variant lives in `SponsorBlock.tsx` and is still
// used on /system as a deliberate operator-facing showcase. Use this
// `<SponsorBanner />` everywhere else.

import Link from "next/link";

type Creative = {
  id: "fred" | "lbp" | "cps";
  eyebrow: string;
  title: string;
  blurb: string;
  cta: string;
  href: string;
  utm: { source: string; medium: string; campaign: string };
};

const FRED: Creative = {
  id: "fred",
  eyebrow: "Sponsor",
  title: "Fred — Live with the Host",
  blurb: "Tap in to Fred's circle. Compound the days.",
  cta: "Open",
  href: "https://circlern.com/host/eef969fc-01ae-4af5-95af-ad0f104488cc",
  utm: { source: "omni-sponsor", medium: "newsletter", campaign: "fred-circle" },
};

const LBP: Creative = {
  id: "lbp",
  eyebrow: "Partner",
  title: "Live Better Podcast",
  blurb: "Show + community from our podcast partner.",
  cta: "Listen",
  href: "https://livebetterpodcast.com",
  utm: { source: "omni-sponsor", medium: "newsletter", campaign: "live-better-podcast" },
};

const CPS: Creative = {
  id: "cps",
  eyebrow: "Featured",
  title: "Psych & Custody Evaluations",
  blurb: "Trusted forensic evaluations across Utah.",
  cta: "Learn",
  href: "https://psychandcustodyevaluations.com",
  utm: { source: "omni-sponsor", medium: "newsletter", campaign: "cps-feature" },
};

const CREATIVES: Creative[] = [FRED, LBP, CPS];

function trackedHref(c: Creative, slug: string): string {
  try {
    const u = new URL(c.href);
    u.searchParams.set("utm_source", c.utm.source);
    u.searchParams.set("utm_medium", c.utm.medium);
    u.searchParams.set("utm_campaign", c.utm.campaign);
    u.searchParams.set("ref", slug);
    return u.toString();
  } catch {
    return c.href;
  }
}

function pickByPostSeed(seed: string): Creative {
  // Stable per post — same post always shows the same sponsor, but
  // distribution across posts roughly matches creative weight (Fred 5,
  // LBP 2, CPS 2).
  const weights = [5, 2, 2];
  const total = weights.reduce((a, b) => a + b, 0);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const roll = Math.abs(h) % total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) return CREATIVES[i];
  }
  return CREATIVES[0];
}

export function SponsorBanner({
  slug,
  seed,
  className,
}: {
  slug: string;
  /** Stable seed (e.g. post slug) so the same post always picks the same creative. */
  seed?: string;
  className?: string;
}) {
  const creative = seed ? pickByPostSeed(seed) : FRED;
  const href = trackedHref(creative, slug);
  return (
    <Link
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      data-omni-creative={creative.id}
      data-track={`sponsor_banner_${creative.id}`}
      className={[
        "osb-banner group flex items-center gap-3 sm:gap-4",
        "w-full max-w-full box-border",
        "px-4 sm:px-5 py-3 my-5",
        "rounded-xl no-underline text-inherit",
        "border transition-colors",
        className || "",
      ]
        .join(" ")
        .trim()}
      style={{
        borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
        background: "color-mix(in srgb, currentColor 4%, transparent)",
        font: "inherit",
        lineHeight: 1.35,
      }}
    >
      <span
        aria-hidden
        className="shrink-0"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "currentColor",
          opacity: 0.55,
        }}
      />
      <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="uppercase"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            opacity: 0.7,
          }}
        >
          {creative.eyebrow}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{creative.title}</span>
        <span style={{ opacity: 0.35, fontSize: 12 }}>·</span>
        <span style={{ fontSize: 13, opacity: 0.72 }} className="hidden sm:inline">
          {creative.blurb}
        </span>
      </span>
      <span
        className="shrink-0"
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid color-mix(in srgb, currentColor 24%, transparent)",
        }}
      >
        {creative.cta} →
      </span>
    </Link>
  );
}
