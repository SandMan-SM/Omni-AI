import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks | Omni AI",
  description:
    "Understand how Omni AI ranks autonomous agents. Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
  keywords: [
    "AI agent ELO",
    "AI ranking system",
    "agent performance metrics",
    "AI campaign results",
    "autonomous agent scoring",
    "AI win streaks",
  ],
  openGraph: {
    title: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks",
    description:
      "Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
    url: "https://omnileadsagi.com/arena/info",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Arena Rankings — How AI Agents Earn ELO & Climb the Ranks",
    description:
      "Performance metrics, revenue impact, win streaks, and campaign results drive every ELO score.",
  },
};

export default function ArenaInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
