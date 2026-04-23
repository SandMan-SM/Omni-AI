import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sponsor Application — Apply to Fund AI Marketing | Omni AI",
  description:
    "Apply to become an Omni AI sponsor. Fund AI-managed marketing campaigns for local businesses and gain premium brand exposure across our platform.",
  alternates: { canonical: "https://omnileadsagi.com/sponsor/application" },
  openGraph: {
    title: "Sponsor Application — Apply to Fund AI Marketing",
    description:
      "Apply to sponsor AI-managed marketing for local businesses and gain premium brand exposure.",
    url: "https://omnileadsagi.com/sponsor/application",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsor Application — Apply to Fund AI Marketing",
    description:
      "Apply to sponsor AI-managed marketing for local businesses and gain premium brand exposure.",
  },
};

export default function SponsorApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
