import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema, howToSchema } from "@/components/json-ld";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/campaigns`;

export const metadata: Metadata = {
  title: "AI Video Marketing — AI Scripts, Produces & Optimizes Videos | Omni AI",
  description:
    "Autonomous AI that scripts, produces, and optimizes marketing videos. Smart copy, auto-optimization, and performance tracking built in.",
  keywords: [
    "AI video marketing",
    "AI video production",
    "automated marketing videos",
    "AI copywriting",
    "video optimization AI",
    "marketing automation",
  ],
  alternates: { canonical: pageUrl },
  openGraph: {
    title: "AI Video Marketing — AI Scripts, Produces & Optimizes Videos",
    description:
      "Autonomous AI that scripts, produces, and optimizes marketing videos with smart copy and performance tracking.",
    url: pageUrl,
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Video Marketing — AI Scripts, Produces & Optimizes Videos",
    description:
      "Autonomous AI that scripts, produces, and optimizes marketing videos with smart copy and performance tracking.",
  },
};

// Service schema — /campaigns is the product page for AI Video Marketing,
// one of the three core Omni AI offerings (alongside AI Lead Generation
// and Business Automation). The sitewide SoftwareApplication schema
// declares the platform as a whole; this Service schema pins down the
// specific video-production offering so Google + LLMs can cite it for
// narrow queries ("AI video marketing platform", "AI that writes and
// edits video ads", "autonomous video campaign tool"). Without this,
// the page ranks behind competitors who declare typed Service entities
// for the same vertical.
//
// providerMobility "static" is the correct value for a remote SaaS
// service (as opposed to "dynamic" which is for services that travel
// to the customer, like a plumber). Leaving it out means Google
// defaults to a weaker match score.
//
// Nested Offer with price "0" signals the free tier includes campaign
// generation — same framing as the sitewide softwareSchema.offers to
// keep cross-schema consistency clean in Search Console.
const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Omni AI Campaigns — Autonomous AI Video Marketing",
  serviceType: "AI Video Production & Marketing Automation",
  description:
    "Autonomous AI that writes scripts, produces video ads, tests variants, and scales winners. Auto-optimization, performance ranking, and multi-platform distribution built in.",
  provider: {
    "@type": "Organization",
    name: "Omni AI",
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
  },
  areaServed: { "@type": "Place", name: "Worldwide" },
  audience: {
    "@type": "Audience",
    audienceType:
      "Marketing agencies, solo creators, and lean growth teams producing volume video content.",
  },
  category: "Marketing Automation",
  url: pageUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: `${siteUrl}/join`,
    description:
      "Free tier includes autonomous campaign generation. Paid tiers unlock priority compute and autonomous distribution.",
  },
};

// HowTo schema — the /campaigns page body renders a visible 4-step
// process diagram (AI Creates → Deploy & Test → Rank & Learn → Scale
// Winners). HowTo maps that process to a retrievable schema entity
// that LLMs preferentially cite for "how does Omni AI generate video
// ads?" / "how does AI auto-optimize marketing campaigns?" queries.
//
// Each `step.name` + `step.text` is byte-aligned with the visible
// `steps` array in app/campaigns/page.tsx. Google's HowTo spam check
// flags drift between the schema and visible page content, so these
// two must stay in sync — if the visible steps change, update this
// block in the same commit.
const campaignsHowToSchema = howToSchema({
  name: "How Omni AI Automates Your Video Marketing",
  description:
    "The 4-step autonomous workflow: AI generates video ads from your brand data, deploys them across channels, tracks performance, and scales winning creative automatically.",
  url: pageUrl,
  image: `${siteUrl}/og-image.png`,
  steps: [
    {
      name: "AI Creates",
      text: "Videos generated from your brand data. Omni AI scripts, produces, and edits marketing videos tailored to your brand voice and audience.",
    },
    {
      name: "Deploy & Test",
      text: "Published across your channels. Variants are launched simultaneously across social media, paid ads, email, and SMS for real-world performance testing.",
    },
    {
      name: "Rank & Learn",
      text: "Performance tracked automatically. Every video is measured, and the AI identifies top performers while surfacing underperformers in real-time.",
    },
    {
      name: "Scale Winners",
      text: "Top videos amplified, losers replaced. Underperforming content is swapped out automatically — your campaigns evolve without manual intervention.",
    },
  ],
});

export default function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={serviceSchema} />
      <JsonLd data={campaignsHowToSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Campaigns", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
