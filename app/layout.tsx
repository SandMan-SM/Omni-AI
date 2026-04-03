import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { JsonLd, organizationSchema, websiteSchema, softwareSchema } from "@/components/json-ld";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://omnileadsagi.com"),
  title: "Omni AI — Autonomous Lead Generation & AI Business Automation",
  description: "Omni AI builds autonomous AI systems that generate leads, run operations, and scale businesses 24/7. Explore AI-powered campaigns, lead qualification, and real-time optimization.",
  keywords: ["AI lead generation", "autonomous AI", "AI business automation", "marketing automation", "AI agents", "lead qualification", "AI campaigns"],
  alternates: {
    canonical: "https://omnileadsagi.com",
  },
  openGraph: {
    title: "Omni AI — Autonomous Lead Generation & AI Business Automation",
    description: "Autonomous AI systems that generate leads, run operations, and scale businesses 24/7. No micromanagement required.",
    url: "https://omnileadsagi.com",
    siteName: "Omni AI",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://omnileadsagi.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Omni AI — Autonomous Lead Generation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI — Autonomous Lead Generation & AI Business Automation",
    description: "Autonomous AI systems that generate leads, run operations, and scale businesses 24/7.",
    images: ["https://omnileadsagi.com/og-image.png"],
  },
  icons: {
    icon: "/favicon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <JsonLd data={softwareSchema} />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
