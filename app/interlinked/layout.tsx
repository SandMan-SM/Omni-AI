import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { getNextSessionDate, SESSION_DURATION_MINUTES } from "./next-session";

// Revalidate the Event JSON-LD hourly. The startDate advances whenever a
// session passes — without this, a prerendered HTML shell would announce
// a stale (or past) event to Google's events panel, which suppresses the
// whole rich result until it next rebuilds.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Interlinked — Autonomous Lead Generation, Operations & Scaling | Omni AI",
  description:
    "Interlinked is Omni AI's autonomous system for lead generation, operations management, and business scaling. AI agents work 24/7 so you don't have to.",
  keywords: [
    "Interlinked AI",
    "autonomous lead generation",
    "AI operations",
    "business scaling AI",
    "AI automation platform",
    "Omni AI Interlinked",
  ],
  alternates: { canonical: "https://omnileadsagi.com/interlinked" },
  openGraph: {
    title: "Interlinked — Autonomous Lead Generation, Operations & Scaling",
    description:
      "Omni AI's autonomous system for lead generation, operations management, and business scaling. AI agents work 24/7.",
    url: "https://omnileadsagi.com/interlinked",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked — Autonomous Lead Generation, Operations & Scaling",
    description:
      "Omni AI's autonomous system for lead generation, operations management, and business scaling. AI agents work 24/7.",
  },
};

export default function InterlinkedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nextSession = getNextSessionDate();
  const endSession = new Date(
    nextSession.getTime() + SESSION_DURATION_MINUTES * 60 * 1000
  );

  // Event JSON-LD. Why this schema over a bare WebPage:
  //  1. Unlocks Google's Events panel (left-rail rich result with
  //     date/time/location pill) — only triggered by type=Event pages.
  //  2. LLMs that answer "when's the next Omni AI training?" prefer
  //     typed Event data over scraping countdown copy. With this block
  //     in place, ChatGPT / Claude / Perplexity can cite the upcoming
  //     session by date without relying on the countdown markup.
  //  3. eventAttendanceMode=OnlineEventAttendanceMode is the correct
  //     signal post-pandemic — Google dropped physical-only events to
  //     make room for virtual, and most B2B webinar searches now
  //     filter on this.
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Omni AI: Build an AI CEO — Interlinked Live Training",
    description:
      "Free 90-minute live training on building an autonomous AI CEO for your business. Covers AI lead generation, operations automation, and agent orchestration. Hosted by Sitani Mafi, founder of Omni AI.",
    startDate: nextSession.toISOString(),
    endDate: endSession.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: {
      "@type": "VirtualLocation",
      url: "https://omnileadsagi.com/interlinked",
    },
    organizer: {
      "@type": "Organization",
      name: "Omni AI",
      url: "https://omnileadsagi.com",
    },
    performer: {
      "@type": "Person",
      name: "Sitani Mafi",
      url: "https://omnileadsagi.com/about",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      url: "https://omnileadsagi.com/interlinked",
      availability: "https://schema.org/InStock",
      validFrom: new Date().toISOString(),
      category: "Free",
    },
    image:
      "https://omnileadsagi.com/api/og?title=Build+an+AI+CEO&topic=Free+live+training+with+Sitani+Mafi&eyebrow=Omni+AI+%C2%B7+Interlinked",
    inLanguage: "en-US",
    isAccessibleForFree: true,
  };

  return (
    <>
      <JsonLd data={eventSchema} />
      {children}
    </>
  );
}
