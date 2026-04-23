import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/sponsor`;

// /sponsor is a logged-in sponsor portal, not a public marketing page.
// The page body (app/sponsor/page.tsx) shows live sponsored-client
// activity (ships, MRR, leads) for authenticated sponsors; unauthenticated
// visitors get a "Sign in" view that routes them to /sponsor/info for
// public marketing content.
//
// Previously this layout shipped public-marketing metadata + a WebPage
// schema claiming it was "Sponsor Omni AI — Partner with an AI-Powered
// Marketing Agency", which was a content-schema mismatch Google and
// LLM retrievers flag as a thin-content / doorway-page signal. The fix:
//
//   1. robots: noindex, nofollow — don't index a portal page
//   2. Drop the false public-marketing WebPage schema entirely
//   3. Keep the breadcrumbSchema (navigation affordance for /sponsor/info
//      and /sponsor/application breadcrumbs that use /sponsor as the
//      middle crumb — Google accepts noindex middles in breadcrumb chains)
//   4. Honest portal-intent metadata title/description
//   5. /sponsor removed from app/sitemap.ts in the same commit
//
// /sponsor/info remains the canonical public marketing page and the
// one in the sitemap. The sponsor-journey funnel is now:
//   /sponsor/info  (public — "what is the Omni AI sponsor program?")
//     → /sponsor/application  (public — apply form)
//       → /sponsor  (portal — logged-in sponsor dashboard, noindex)
export const metadata: Metadata = {
  title: "Sponsor Portal · Omni AI",
  description:
    "Logged-in portal for Omni AI sponsors. Live build-log activity, sponsored-client metrics, and ship history for active sponsorships. Public sponsor-program info lives at /sponsor/info.",
  alternates: { canonical: pageUrl },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function SponsorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Breadcrumb schema — kept for the navigation affordance. Even
          though /sponsor is noindex, /sponsor/info and /sponsor/application
          both use "Sponsor" (→ /sponsor) as their middle crumb. Google
          accepts noindex middle items in breadcrumb chains — they render
          in the SERP breadcrumb chip for the child pages, and the link
          still resolves for logged-in users who land on /sponsor/info
          via search. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Sponsor", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
