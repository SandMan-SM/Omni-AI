import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Consultation — Omni AI",
  description:
    "A free 30-minute working session for Omni AI affiliates. We map your audience, your angle, and the Omni AI products that will convert for them — then hand you a written game plan.",
  alternates: { canonical: "https://omnileadsagi.com/affiliate/consultation/info" },
  openGraph: {
    title: "Affiliate Consultation — Omni AI",
    description: "A free 30-minute working session to plan your Omni AI affiliate strategy.",
    url: "https://omnileadsagi.com/affiliate/consultation/info",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
