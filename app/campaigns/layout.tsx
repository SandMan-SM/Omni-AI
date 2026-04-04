import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Marketing — AI Scripts, Produces & Optimizes Videos | Omni AI",
  description:
    "Autonomous AI that scripts, produces, and optimizes marketing videos. Smart copy, auto-optimization, and performance tracking built in.",
  keywords: [
    "AI video marketing",
    "AI video production",
    "automated marketing videos",
    "AI copywriting",
    "video optimization AI",
    "marketing automation",
  ],
  openGraph: {
    title: "AI Video Marketing — AI Scripts, Produces & Optimizes Videos",
    description:
      "Autonomous AI that scripts, produces, and optimizes marketing videos with smart copy and performance tracking.",
    url: "https://omnileadsagi.com/campaigns",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Video Marketing — AI Scripts, Produces & Optimizes Videos",
    description:
      "Autonomous AI that scripts, produces, and optimizes marketing videos with smart copy and performance tracking.",
  },
};

export default function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
