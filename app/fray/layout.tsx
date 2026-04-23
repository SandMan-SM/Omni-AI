import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VIP Sponsor — Fund 3 Businesses, One Monthly Investment | Omni AI",
  description:
    "Sponsor AI-managed marketing for Youngs, Leifson Built, and Omni Leads LLC. Websites, Facebook ads, lead capture, and newsletters — fully autonomous. $3,000/mo, 4-month commitment.",
  alternates: { canonical: "https://omnileadsagi.com/fray" },
  openGraph: {
    title: "VIP Sponsor — Fund 3 Businesses, One Monthly Investment",
    description:
      "AI-managed marketing for 3 businesses. Websites, Facebook ads, lead capture, and newsletters. $3,000/mo.",
    url: "https://omnileadsagi.com/fray",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "VIP Sponsor — Fund 3 Businesses, One Monthly Investment",
    description:
      "AI-managed marketing for 3 businesses. Websites, Facebook ads, lead capture, and newsletters. $3,000/mo.",
  },
};

export default function FrayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
