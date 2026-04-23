import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program — Earn 30% Recurring | Omni AI",
  description:
    "Refer clients to Omni AI and earn 30% recurring on every subscription — no fees, no minimums. Live dashboard, tracked links, paid monthly as long as they stay.",
  alternates: { canonical: "https://omnileadsagi.com/affiliate/info" },
  openGraph: {
    title: "Omni AI Affiliate Program — 30% Recurring Commissions",
    description:
      "Share a tracked link. Earn 30% of every subscription your referrals pay, every month they stay.",
    url: "https://omnileadsagi.com/affiliate/info",
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI Affiliate Program — 30% Recurring",
    description: "Apply in 60 seconds. Share your link. Earn 30% every month.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
