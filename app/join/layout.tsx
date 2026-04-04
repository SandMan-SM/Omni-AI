import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Omni AI — Start Automating Your Business for Free",
  description:
    "Get started with Omni AI for free. Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
  keywords: [
    "join Omni AI",
    "AI automation signup",
    "free AI agents",
    "AI lead generation",
    "business automation",
    "get started AI",
  ],
  openGraph: {
    title: "Join Omni AI — Start Automating Your Business for Free",
    description:
      "Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
    url: "https://omnileadsagi.com/join",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Join Omni AI — Start Automating Your Business for Free",
    description:
      "Deploy AI agents for lead generation, business automation, and scaling — no credit card required.",
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
