import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a Sponsor — AI-Powered Lead Generation & Automation | Omni AI",
  description:
    "Invest in AI-powered lead generation and business automation. 24/7 engagement, marketing intelligence, and analytics for sponsors.",
  keywords: [
    "Omni AI sponsorship",
    "AI lead generation sponsor",
    "AI business automation",
    "marketing sponsorship",
    "AI engagement",
    "sponsor AI agents",
  ],
  alternates: { canonical: "https://omnileadsagi.com/sponsor/info" },
  openGraph: {
    title: "Become a Sponsor — AI-Powered Lead Generation & Automation",
    description:
      "Invest in AI-powered lead generation and business automation. 24/7 engagement, marketing intelligence, and analytics.",
    url: "https://omnileadsagi.com/sponsor/info",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a Sponsor — AI-Powered Lead Generation & Automation",
    description:
      "Invest in AI-powered lead generation and business automation. 24/7 engagement, marketing intelligence, and analytics.",
  },
};

export default function SponsorInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
