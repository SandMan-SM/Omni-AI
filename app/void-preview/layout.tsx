import type { Metadata } from "next";

// Internal hero-component preview. Not a real product page — keep it out of
// search engines so it never ranks or gets crawled into the sitemap.
export const metadata: Metadata = {
  title: "Void Preview (internal)",
  description: "Internal preview of the VoidHero component. Not a real page.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
