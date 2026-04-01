import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Website Service — AI-Managed Development & Hosting | Omni AI",
  description:
    "Managed hosting infrastructure powered by AI-driven optimization. We deploy, monitor, and scale your web applications so you can focus on growth, not servers.",
  alternates: {
    canonical: "https://omnileadsagi.com/website/development",
  },
  openGraph: {
    title: "Website Service — AI-Managed Development & Hosting",
    description:
      "Custom website development with managed hosting, 24/7 monitoring, security hardening, and AI-driven performance optimization. Zero micromanagement required.",
    url: "https://omnileadsagi.com/website/development",
    siteName: "Omni AI",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://omnileadsagi.com/website/development/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Omni AI — Website Development & Managed Hosting Service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Website Service — AI-Managed Development & Hosting | Omni AI",
    description:
      "Custom website development with managed hosting, 24/7 monitoring, and AI-driven optimization.",
    images: ["https://omnileadsagi.com/website/development/opengraph-image"],
  },
};

export default function WebsiteDevelopmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
