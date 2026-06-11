import type { Metadata } from "next";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/portal`;

// /portal hosts per-client demo dashboards behind a simple sign-in.
// It is a portal surface, not a public marketing page — same noindex
// playbook as /fray and /sponsor: metadata is portal-honest, robots
// blocks indexing at the layout level, and app/robots.ts carries the
// matching disallow as defense-in-depth. No JSON-LD, no sitemap entry.
export const metadata: Metadata = {
  title: "Client Portal · Omni AI",
  description: "Client portal — demo dashboards. Unlisted.",
  alternates: { canonical: pageUrl },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
