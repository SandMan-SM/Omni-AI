import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Omni AI - Agentic Infrastructure",
  description: "Welcome to AGI. Autonomous AI systems that generate leads, run operations, and scale businesses.",
  keywords: ["AI", "AGI", "automation", "marketing", "lead generation"],
  openGraph: {
    title: "Omni AI - Agentic Infrastructure",
    description: "Welcome to AGI. Autonomous AI systems that generate leads, run operations, and scale businesses.",
    url: "https://omni-ai-theta.vercel.app",
    siteName: "Omni AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omni AI - Agentic Infrastructure",
    description: "Welcome to AGI. Autonomous AI systems that generate leads, run operations, and scale businesses.",
  },
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} overflow-x-hidden`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
