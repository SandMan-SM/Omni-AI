// Federation sponsor rotation — single source of truth for the
// 3-card cross-portfolio block that ships on every operator-owned
// site's newsletter. Every site renders the SAME three sponsors,
// just with their own `host` slug appended for ref-attribution.
//
// Order matters — rank 1 carries the "Featured" badge + amber border
// in the visual treatment. Operator's call: CPS in slot 1 (the work
// the rest of the federation is repair-rooted in), Fred Circle in 2
// (the room the Society's information moves through), Live Better
// OTD in 3 (the show + community surface).
//
// To change a sponsor's URL or copy, edit ONLY this file. Every
// federation-site copy of `SponsorRotation.tsx` imports from here
// (Omni AI Website itself) or is a hand-synced sibling that mirrors
// the SLOTS verbatim. We chose copy-paste with a "synced from Omni
// AI Website" header over a published npm package because the cross-
// repo deploy story is simpler — one Edit per sibling, no version
// drift, no registry plumbing.

export type SponsorBadge = "Featured" | "Sponsor" | "Partner";

export type SponsorSlot = {
  // Stable host-slug of THIS sponsor — used to exclude this slot from
  // its own site's rotation (CPS doesn't promote CPS in its own
  // newsletter). Must match the federation case-study slug.
  slug: string;
  rank: 1 | 2 | 3;
  brand: string;
  tagline: string;
  blurb: string;
  // Base URL — the host slug is appended at render time as ?ref=<host>.
  hrefBase: string;
  badge: SponsorBadge;
};

export const FEDERATION_SPONSORS: SponsorSlot[] = [
  {
    slug: "cps",
    rank: 1,
    brand: "CPS · The Repair",
    tagline: "Forensic psychology · custody work.",
    blurb:
      "Where families go when one tear, somewhere upstream, has fractured the system. CPS is the operator who walks people through the repair.",
    hrefBase: "https://psychandcustodyevaluations.com",
    badge: "Featured",
  },
  {
    slug: "fred-circle",
    rank: 2,
    brand: "Fred Circle",
    tagline: "Modern minds, real circles.",
    blurb:
      "Small accountable groups for builders, parents, operators, and the otherwise scattered. Fred Circle is the place the Society's information moves through every week.",
    hrefBase: "https://fredcircle.com",
    badge: "Sponsor",
  },
  {
    slug: "live-better-on-the-drip",
    rank: 3,
    brand: "Live Better · On The Drip",
    tagline: "Show + community.",
    blurb:
      "The conversations that the Interlinked manifesto puts in public. Honest interviews about reassembling a life that was never meant to be split.",
    hrefBase: "https://livebetterpodcast.com",
    badge: "Partner",
  },
];

// Returns the slots that should render on a given host site —
// excludes the slot whose own slug matches the host (no self-promo)
// and re-numbers ranks so the remaining cards still read 1/2(/3).
export function slotsForHost(host: string): SponsorSlot[] {
  return FEDERATION_SPONSORS
    .filter((s) => s.slug !== host)
    .map((s, i) => ({ ...s, rank: (i + 1) as 1 | 2 | 3 }));
}

// Build the per-host attribution URL. Every sponsor click on every
// federation site stamps `?ref=<host>` so cross-portfolio attribution
// shows up in the destination site's analytics + the omni events bus.
export function buildSponsorHref(slot: SponsorSlot, host: string): string {
  const sep = slot.hrefBase.includes("?") ? "&" : "?";
  return `${slot.hrefBase}${sep}ref=${encodeURIComponent(host)}`;
}
