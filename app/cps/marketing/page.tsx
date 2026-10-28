import type { Metadata } from "next";
import { CpsMarketingAccess } from "./CpsMarketingAccess";
const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/cps/marketing`;
const OG_IMAGE_URL = `${SITE_URL}/api/og?title=CPS%20Marketing&topic=Private%20operator%20report`;
export const metadata: Metadata = {
  title: "How Your Marketing Is Actually Working · CPS × Omni AI",
  description:
    "Private marketing report for authorized Clinical and Professional Solutions operators.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "How Your Marketing Is Actually Working · CPS × Omni AI",
    description:
      "Private marketing report for authorized CPS operators.",
    url: PAGE_URL,
    type: "website",
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: "Inside the Build · CPS × Omni AI" }],
  },
  twitter: {
    site: "@SitaniMafi",
    creator: "@SitaniMafi",
    card: "summary_large_image",
    title: "How Your Marketing Is Actually Working · CPS × Omni AI",
    description:
      "Private marketing report for authorized CPS operators.",
    images: [OG_IMAGE_URL],
  },
  robots: { index: false, follow: false },
};

export default function CpsMarketingPage() {
  return <CpsMarketingAccess />;
}
