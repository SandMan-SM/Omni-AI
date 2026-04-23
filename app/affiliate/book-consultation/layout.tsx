import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book an Affiliate Consultation | Omni AI",
  description:
    "A free 30-minute working session for Omni AI affiliates. We map your audience, your angle, and the right Omni AI products to recommend — then hand you a written game plan.",
  alternates: {
    canonical: "https://omnileadsagi.com/affiliate/book-consultation",
  },
  openGraph: {
    title: "Book an Affiliate Consultation | Omni AI",
    description:
      "Free 30-minute session to plan your Omni AI affiliate strategy. Written game plan included.",
    url: "https://omnileadsagi.com/affiliate/book-consultation",
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book an Affiliate Consultation | Omni AI",
    description: "Free 30-min session. Written game plan. No obligation.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
