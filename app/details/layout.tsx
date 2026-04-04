import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upcoming Sessions — Live AI Strategy Webinars & Demos | Omni AI",
  description:
    "Join our next live AI strategy session. Webinars, live demos, Q&A, and hands-on strategy — learn how to deploy AI agents for your business.",
  keywords: [
    "AI webinars",
    "AI strategy sessions",
    "live AI demos",
    "AI business strategy",
    "Omni AI events",
    "AI Q&A sessions",
  ],
  openGraph: {
    title: "Upcoming Sessions — Live AI Strategy Webinars & Demos",
    description:
      "Join our next live AI strategy session. Webinars, live demos, Q&A, and hands-on strategy for AI automation.",
    url: "https://omnileadsagi.com/details",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Upcoming Sessions — Live AI Strategy Webinars & Demos",
    description:
      "Join our next live AI strategy session. Webinars, live demos, Q&A, and hands-on strategy for AI automation.",
  },
};

export default function DetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
