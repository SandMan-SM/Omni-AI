import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sponsor Omni AI — Partner with an AI-Powered Marketing Agency",
  description:
    "Become a sponsor of Omni AI. Partner with us to fund AI-managed marketing campaigns for local businesses and gain brand visibility across our ecosystem.",
  keywords: [
    "Omni AI sponsor",
    "AI marketing sponsor",
    "business sponsorship",
    "AI agency partner",
    "marketing partnership",
  ],
  alternates: { canonical: "https://omnileadsagi.com/sponsor" },
  openGraph: {
    title: "Sponsor Omni AI — Partner with an AI-Powered Marketing Agency",
    description:
      "Partner with Omni AI to fund AI-managed marketing for local businesses and gain brand visibility.",
    url: "https://omnileadsagi.com/sponsor",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsor Omni AI — Partner with an AI-Powered Marketing Agency",
    description:
      "Partner with Omni AI to fund AI-managed marketing for local businesses and gain brand visibility.",
  },
};

export default function SponsorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
