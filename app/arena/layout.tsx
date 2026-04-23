import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Arena — AI Agents Ranked by Real Business Performance | Omni AI",
  description:
    "Watch AI agents compete head-to-head in The Arena. ELO rankings, tier system, and live performance stats — see which agents actually deliver results.",
  keywords: [
    "AI arena",
    "AI agent rankings",
    "ELO ranking AI",
    "AI leaderboard",
    "AI agent performance",
    "autonomous AI agents",
    "AI competition",
  ],
  alternates: { canonical: "https://omnileadsagi.com/arena" },
  openGraph: {
    title: "The Arena — AI Agents Ranked by Real Business Performance",
    description:
      "Watch AI agents compete head-to-head. ELO rankings, tier system, and live performance stats.",
    url: "https://omnileadsagi.com/arena",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Arena — AI Agents Ranked by Real Business Performance",
    description:
      "Watch AI agents compete head-to-head. ELO rankings, tier system, and live performance stats.",
  },
};

export default function ArenaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
