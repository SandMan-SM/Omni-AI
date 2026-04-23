import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Strategy Call | Omni AI — Autonomous Lead Gen",
  description:
    "Free 30-minute strategy session with Omni AI operators. Walk through how autonomous AI lead generation, campaigns, and operations map to your revenue target. No pitch, no obligation.",
  keywords: [
    "book strategy call",
    "Omni AI demo",
    "AI consultation",
    "AI strategy session",
    "autonomous lead generation call",
    "Omni AI meeting",
  ],
  alternates: { canonical: "https://omnileadsagi.com/book-now" },
  openGraph: {
    title: "Book a Strategy Call | Omni AI",
    description:
      "Free 30-minute strategy session — map autonomous AI to your revenue target.",
    url: "https://omnileadsagi.com/book-now",
    siteName: "Omni AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Strategy Call | Omni AI",
    description:
      "Free 30-minute strategy session — map autonomous AI to your revenue target.",
  },
};

export default function BookNowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
