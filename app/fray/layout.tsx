import type { Metadata } from "next";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/fray`;

// /fray is a personalized VIP dashboard — the page greets a specific
// sponsor by name ("Hey Fray 👋") and shows live-build status + MRR +
// leads + newsletter activity for 3 sponsored businesses (Youngs
// Cabinet Refinishing, Leifson Built, Omni Leads LLC). It is NOT a
// public marketing surface for a VIP sponsorship offering.
//
// Previously this layout shipped public-marketing metadata ("VIP
// Sponsor — Fund 3 Businesses") and a typed Service+Offer schema
// declaring $3,000/month with a 4-month commitment term. Both
// misrepresented the page: Google + LLM retrievers would send
// sponsorship-intent traffic here expecting a pitch/application
// flow, but the page would render a logged-in-looking live
// dashboard instead. That content/schema mismatch is what Google's
// helpful-content system flags as misleading; worse, /fray got
// surfaced in Sitelinks / Knowledge Panel results next to /sponsor/info
// and confused the funnel.
//
// Fix follows the same playbook used for /sponsor (Cycle 142):
//   1. Metadata declares this as a "VIP Dashboard" — portal-honest.
//   2. robots: noindex,nofollow — personalized dashboards should not
//      be in Google's index at all.
//   3. Strip the false fraySponsorshipService schema entirely. No
//      JSON-LD on this layout — the page has no publicly-retrievable
//      entity to declare.
//   4. No breadcrumbSchema — breadcrumbs don't make sense on a
//      personalized portal without a public parent hierarchy.
//   5. Sitemap entry removed in the same commit (see app/sitemap.ts).
//
// Sponsor funnel canonical flow:
//   /sponsor/info     (public: program overview)
//   /sponsor/application (public: apply to sponsor)
//   /sponsor          (portal: sponsor dashboard — noindex)
//   /fray             (portal: VIP sponsor dashboard — noindex) ←── this
//
// If at some point /fray should promote a real VIP sponsorship tier,
// the marketing copy + Service+Offer schema belongs on a dedicated
// public landing page (e.g. /vip-sponsor/info), not on the portal.
export const metadata: Metadata = {
  title: "VIP Dashboard · Omni AI",
  description:
    "Personalized VIP sponsor dashboard — not a public page. Unlisted.",
  alternates: { canonical: pageUrl },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function FrayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
