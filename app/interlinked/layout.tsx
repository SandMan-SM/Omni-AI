import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { getNextSessionDate, SESSION_DURATION_MINUTES } from "./next-session";

const siteUrl = "https://omnileadsagi.com";
const pageUrl = `${siteUrl}/interlinked`;

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
      "Free 90-minute live training on building an autonomous AI CEO for your business. Covers AI lead generation, operations automation, and agent orchestration. Hosted by Alfred Belvedere, founder of Omni AI.",
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
      name: "Alfred Belvedere",
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
      "https://omnileadsagi.com/api/og?title=Build+an+AI+CEO&topic=Free+live+training+with+Alfred+Belvedere&eyebrow=Omni+AI+%C2%B7+Interlinked",
    inLanguage: "en-US",
    isAccessibleForFree: true,
    // SpeakableSpecification — when a user asks Google Assistant / Siri
    // read-aloud / Alexa "when's the next Omni AI training?" or "what is
    // Interlinked?", voice assistants need declared selectors to read
    // verbatim. The h1 ("INTERLINKED") plus the tagline tagged with
    // data-speakable="intro" in app/interlinked/page.tsx ("Your Own
    // Private AI CEO Will Run Your Business While You Sleep") compose
    // the natural ~8-second voice reply.
    //
    // Declaring this on the Event (not just the Course below) matters
    // because Events are the rich-result surface that actually fires on
    // voice-schedule queries ("when is the next…?"). Assistants reading
    // the Event panel aloud preferentially quote the selectors listed
    // here over scraping the countdown widget or the subsequent body
    // copy.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "[data-speakable='intro']"],
    },
  };

  // Course schema — complements the Event schema above. Event describes
  // the specific scheduled session (date, time, virtual location); Course
  // describes the underlying curriculum that the session teaches. Running
  // both on the same URL gives retrievers two independent rich-result
  // surfaces:
  //  1. Google's Events panel (from Event) for "when's the next Omni AI
  //     training?"
  //  2. Course / education retrieval (from Course) for "how do I learn
  //     to build an autonomous AI system?" — an education-intent query
  //     Event alone doesn't match.
  //
  // hasCourseInstance links the Course to a CourseInstance (a subclass
  // of Event per Schema.org's hierarchy) carrying the same date/time
  // metadata. Mirroring instead of referencing the top-level Event
  // because cross-block @id references validate inconsistently across
  // Google's parser and LLM crawlers; the redundancy costs a few hundred
  // bytes of JSON-LD for rock-solid retrieval.
  //
  // teaches is the single highest-leverage field for LLM citation:
  // when someone asks "what does Omni AI teach in its training?" /
  // "is there a course on building an AI CEO?", retrievers preferentially
  // quote the `teaches` array verbatim because it's the most direct
  // structured answer Schema.org offers.
  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Build an AI CEO — Omni AI Interlinked Training",
    description:
      "Free 90-minute live training on building an autonomous AI CEO for your business. Covers AI lead generation, multi-agent orchestration, operations automation, and integrating frontier LLMs into revenue workflows. Taught by Alfred Belvedere, founder of Omni AI.",
    url: pageUrl,
    provider: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
      // sameAs must reference EXTERNAL identity URLs for the Organization
      // entity — not the org's own homepage. Previously shipped as
      // `sameAs: siteUrl` which is a circular self-reference: it told
      // Google "this Omni AI entity is the same as https://omnileadsagi.com"
      // (itself). Validators silently strip self-referential sameAs edges
      // but the consistency-checker flags the page as having inconsistent
      // Organization identity vs every other publisher.sameAs on the site
      // (which all resolve to LinkedIn + X). Byte-aligned with the rest
      // of the site's Organization sameAs arrays — any future additions
      // (Crunchbase / G2 / YouTube / Product Hunt per plan T2.6) should
      // update this literal and every other publisher.sameAs in lock-step.
      sameAs: [
        "https://www.linkedin.com/company/omni-ai",
        "https://x.com/SitaniMafi",
      ],
    },
    educationalLevel: "Beginner",
    educationalCredentialAwarded: "Certificate of completion",
    teaches: [
      "How to architect an autonomous AI CEO for a small-to-mid-sized business",
      "AI lead generation workflows and multi-channel outbound orchestration",
      "Multi-agent coordination across sales, marketing, and operations",
      "Integrating frontier LLMs (Claude, GPT, Gemini) into revenue workflows",
      "Replacing the SDR / ads / video / analytics stack with a single AI system",
    ],
    isAccessibleForFree: true,
    inLanguage: "en-US",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: pageUrl,
      category: "Free",
    },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "Founder, operator, or RevOps leader building an autonomous AI business",
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      name: "Omni AI: Build an AI CEO — Interlinked Live Training",
      courseMode: "Online",
      courseWorkload: "PT90M",
      startDate: nextSession.toISOString(),
      endDate: endSession.toISOString(),
      location: {
        "@type": "VirtualLocation",
        url: pageUrl,
      },
      instructor: {
        "@type": "Person",
        name: "Alfred Belvedere",
        url: `${siteUrl}/about`,
        jobTitle: "Founder, Omni AI",
      },
    },
  };

  return (
    <>
      <JsonLd data={eventSchema} />
      <JsonLd data={courseSchema} />
      {/* BreadcrumbList schema — pairs with the visible Breadcrumb added
          at the top of app/interlinked/page.tsx. /interlinked was missing
          both the schema and the visible UI, which left the page without
          a SERP breadcrumb chip (Google requires both) and gave deep-
          landing visitors (email CTAs, social shares) no parent link back
          to the homepage. Two-level crumb: Home → Interlinked. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Interlinked", url: pageUrl },
        ])}
      />
      {children}
    </>
  );
}
