import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up as an Omni AI Affiliate",
  description:
    "Join the Omni AI affiliate program in under a minute. Earn 30% recurring on every client you refer — no fees, no caps, paid monthly.",
  alternates: { canonical: "https://omnileadsagi.com/affiliate/sign-up" },
  openGraph: {
    title: "Sign Up as an Omni AI Affiliate",
    description:
      "Earn 30% recurring on every client you refer. Apply in 60 seconds.",
    url: "https://omnileadsagi.com/affiliate/sign-up",
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign Up as an Omni AI Affiliate",
    description: "30% recurring commissions. 60-second signup.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
