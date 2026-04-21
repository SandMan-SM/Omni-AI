import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a working session · Omni AI · Interlinked",
  description:
    "Free 30-minute working session with Omni AI. We map one AI agent from idea to deployed — you leave with a 90-day plan.",
  openGraph: {
    title: "Book a working session · Omni AI",
    description:
      "30 minutes. Free. We open the Command Center and walk you through the agent that pays for itself fastest inside your business.",
    type: "website",
    url: "https://omnileadsagi.com/interlinked/book-now",
    siteName: "Omni AI · Interlinked",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a working session · Omni AI",
    description:
      "Free 30-min consult. Leave with a 90-day AI-agent plan.",
  },
  alternates: { canonical: "https://omnileadsagi.com/interlinked/book-now" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
