import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interlinked — Autonomous Lead Generation, Operations & Scaling | Omni AI",
  description:
    "Interlinked is Omni AI's autonomous system for lead generation, operations management, and business scaling. AI agents work 24/7 so you don't have to.",
  keywords: [
    "Interlinked AI",
    "autonomous lead generation",
    "AI operations",
    "business scaling AI",
    "AI automation platform",
    "Omni AI Interlinked",
  ],
  alternates: { canonical: "https://omnileadsagi.com/interlinked" },
  openGraph: {
    title: "Interlinked — Autonomous Lead Generation, Operations & Scaling",
    description:
      "Omni AI's autonomous system for lead generation, operations management, and business scaling. AI agents work 24/7.",
    url: "https://omnileadsagi.com/interlinked",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked — Autonomous Lead Generation, Operations & Scaling",
    description:
      "Omni AI's autonomous system for lead generation, operations management, and business scaling. AI agents work 24/7.",
  },
};

export default function InterlinkedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
