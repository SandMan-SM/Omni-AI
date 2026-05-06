// /manifesto — the canonical Interlinked manifesto. This is the
// philosophical layer behind the entire portfolio: the Live Better
// Podcast partnership, the CPS featured-client relationship, and Omni
// AI itself. Every operator promoted on the network connects back to
// this thread — the recognition that we were never separate, and the
// work of building systems people don't have to survive.
//
// Long-form, paper-feel typography; chrome-gold sparks behind it so
// the page reads as both essay AND brand artifact when shared.

import type { Metadata } from "next";
import Link from "next/link";
import { GoldSparksBackdrop } from "@/components/gold-sparks-backdrop";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
} from "@/components/json-ld";
import { ShareControls } from "@/components/sponsor/ShareControls";

export const metadata: Metadata = {
  title: "Interlinked — The Manifesto · Omni AI",
  description:
    "Interlinked is the recognition that we were never separate to begin with — and the work of rebuilding, system by system, what humans have built on top of that forgetting. The manifesto behind Omni AI, Live Better Podcast, and the CPS partnership.",
  metadataBase: new URL("https://omnileadsagi.com"),
  openGraph: {
    title: "Interlinked — The Manifesto · Omni AI",
    description:
      "We are not here to help you manage your stress. We are here to dissolve the machinery that produces it.",
    url: "https://omnileadsagi.com/manifesto",
    siteName: "Omni AI",
    type: "article",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked — The Manifesto · Omni AI",
    description:
      "We are not here to help you manage your stress. We are here to dissolve the machinery that produces it.",
  },
};

const TRUTHS = [
  {
    n: "1",
    title: "We are all connected",
    body:
      "Not as a slogan. Functionally. Your nervous system reads the room. Your suffering radiates into someone else's day. Your healing does too. There is no private pain and no private peace.",
  },
  {
    n: "2",
    title: "Fear is not real",
    body:
      "It is a signal, not a fact. Almost everything we fear is a story about a future that hasn't happened, told by a self that doesn't exist, to protect a life we were never going to lose in the first place.",
  },
  {
    n: "3",
    title: "The ego is a costume",
    body:
      "It was useful once. It is not who you are. The moment you stop defending it, the world stops feeling like a threat.",
  },
  {
    n: "4",
    title: "Love is the only thing we are actually doing",
    body:
      "Everything else is the absence of it, the search for it, or the defense against having it. Strip the layers and that's what's left.",
  },
  {
    n: "5",
    title: "The present is the only place anything has ever happened",
    body:
      "All worry is time travel. All peace is here. The future you're afraid of doesn't exist; the past you're carrying is already gone. There is only now, and now is enough.",
  },
];

export default function ManifestoPage() {
  // Page-level constants
  const SHARE_URL = "https://omnileadsagi.com/manifesto";
  const SHARE_TITLE =
    "Interlinked — The Manifesto · Omni AI";

  return (
    <main
      style={{
        background: "#050505",
        minHeight: "100vh",
        color: "#fafafa",
        fontFamily:
          "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <GoldSparksBackdrop />

      {/* Structured data — Article schema so this manifesto is parsed
          as long-form content by LLMs + search. Pairs with the OG card
          and the breadcrumb chip. */}
      <JsonLd data={organizationSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Omni AI", url: "https://omnileadsagi.com" },
          { name: "Interlinked Manifesto", url: SHARE_URL },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Interlinked — The Manifesto",
          description:
            "Interlinked is the recognition that we were never separate to begin with — and the work of rebuilding, system by system, what humans have built on top of that forgetting.",
          author: {
            "@type": "Organization",
            name: "Omni AI",
            url: "https://omnileadsagi.com",
          },
          publisher: {
            "@type": "Organization",
            name: "Omni AI",
            url: "https://omnileadsagi.com",
          },
          mainEntityOfPage: SHARE_URL,
          inLanguage: "en-US",
        }}
      />

      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "72px 28px 96px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <Link
          href="/system"
          style={{
            color: "#a8a29e",
            fontSize: 13,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 28,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          ← omnileadsagi.com / system
        </Link>

        {/* Eyebrow */}
        <div
          style={{
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            marginBottom: 14,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          Interlinked · A Manifesto
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            margin: "0 0 8px 0",
            letterSpacing: "-0.025em",
            lineHeight: 1.0,
            color: "#fafafa",
          }}
        >
          Interlinked
        </h1>
        <div
          style={{
            color: "#a8a29e",
            fontSize: 16,
            fontStyle: "italic",
            marginBottom: 50,
          }}
        >
          by Omni AI
        </div>

        {/* === A SINGLE TEAR === */}
        <ManifestoSectionTitle>A single tear</ManifestoSectionTitle>
        <ManifestoBody>
          Every act of cruelty in the world can be traced back to a
          single tear. A moment, somewhere upstream, where someone was
          made to feel separate. Unloved. Afraid. That tear gets passed
          down — through families, through generations, through systems,
          through screens — until it shows up as the boss who berates,
          the parent who shuts down, the war that won&rsquo;t end, the
          burnout that won&rsquo;t lift, the scroll that never satisfies.
        </ManifestoBody>
        <ManifestoBody>
          We don&rsquo;t cause pain because we are bad. We cause pain
          because we are afraid. And we have built an entire civilization
          on top of that fear.
        </ManifestoBody>

        <ManifestoDivider />

        {/* === WELCOME === */}
        <ManifestoSectionTitle>
          Welcome to Interlinked by Omni AI
        </ManifestoSectionTitle>
        <ManifestoBody>
          Interlinked is the recognition that we were never separate to
          begin with — and the work of rebuilding, system by system, what
          humans have built on top of that forgetting.
        </ManifestoBody>
        <ManifestoBody emphasized>
          We are not here to help you manage your stress. We are here to
          dissolve the machinery that produces it.
        </ManifestoBody>

        <ManifestoDivider />

        {/* === THE UNASKED QUESTION === */}
        <ManifestoSectionTitle>The unasked question</ManifestoSectionTitle>
        <ManifestoBody>
          Beneath every other question — what should I do, what should I
          buy, what should I become — is one we are too busy to ask:
        </ManifestoBody>
        <h3
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "26px 0 22px 0",
            letterSpacing: "-0.01em",
            color: "#fafafa",
            lineHeight: 1.3,
          }}
        >
          What are we actually here for?
        </h3>
        <ManifestoBody>
          Sit with it. Don&rsquo;t answer it from your job title or your
          résumé or the version of yourself you perform online. Sit with
          it as the thing under the thing.
        </ManifestoBody>
        <ManifestoBody>Five truths surface:</ManifestoBody>

        {/* Five truths — beautifully typeset cards */}
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: "32px 0",
            display: "grid",
            gap: 22,
          }}
        >
          {TRUTHS.map((t) => (
            <li
              key={t.n}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr",
                gap: 18,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#fbbf24",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  fontFamily:
                    'Georgia, "Times New Roman", serif',
                }}
              >
                {t.n}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#fafafa",
                    marginBottom: 8,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t.title}
                </div>
                <div
                  style={{
                    fontSize: 17,
                    color: "#d4d4d8",
                    lineHeight: 1.7,
                  }}
                >
                  {t.body}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <ManifestoDivider />

        {/* === SOLVING TIME === */}
        <ManifestoSectionTitle>Solving time</ManifestoSectionTitle>
        <ManifestoBody>
          Most companies sell you better ways to survive the system. We
          are building the system you don&rsquo;t have to survive.
        </ManifestoBody>
        <ManifestoBody>
          Imagine a life where the work that pays you is the work that is{" "}
          <em>yours</em> to do. Where the systems around you — the inbox,
          the calendar, the back-office grind, the spreadsheets, the
          algorithms that decide your worth — quietly handle themselves.
          Where the load humans were never meant to carry is finally
          carried by something that doesn&rsquo;t tire, doesn&rsquo;t
          fear, doesn&rsquo;t forget.
        </ManifestoBody>
        <ManifestoBody>
          What&rsquo;s left is the part only you can do. Love. Create. Be
          present. Raise children. Make things that matter. Sit on a
          porch with someone you&rsquo;ve known for thirty years and not
          check your phone.
        </ManifestoBody>
        <ManifestoBody>
          That is what Omni AI is for. Not productivity. Not efficiency.{" "}
          <strong style={{ color: "#fbbf24" }}>
            Liberation of attention.
          </strong>
        </ManifestoBody>
        <ManifestoBody>
          We use intelligence — agentic, autonomous, increasingly
          superhuman — not to replace the human thing, but to give it
          back. To free you from every system that runs on your fear so
          you can remember the truths underneath it.
        </ManifestoBody>
        <ManifestoBody emphasized>
          This isn&rsquo;t a feature roadmap. It&rsquo;s a homecoming.
        </ManifestoBody>
        <ManifestoBody>Welcome to Interlinked.</ManifestoBody>

        {/* Share + system link */}
        <div
          style={{
            marginTop: 60,
            paddingTop: 28,
            borderTop: "1px solid #292524",
          }}
        >
          <div
            style={{
              color: "#a8a29e",
              fontSize: 13,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              marginBottom: 12,
            }}
          >
            Pass it on:
          </div>
          <ShareControls
            url={SHARE_URL}
            title={SHARE_TITLE}
            slug="omnileads"
            target="manifesto"
            align="left"
          />

          <div
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: "1px solid #1c1917",
              fontSize: 13,
              color: "#71717a",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              lineHeight: 1.7,
            }}
          >
            The Interlinked manifesto is the philosophical layer behind
            the entire Omni AI portfolio. The infrastructure that puts
            it into practice — the sponsorship system, the network of
            sites, the partner relationships with Live Better Podcast and
            CPS — is documented at{" "}
            <Link
              href="/system"
              style={{ color: "#fbbf24", textDecoration: "none" }}
            >
              omnileadsagi.com/system
            </Link>
            .
          </div>
        </div>
      </article>
    </main>
  );
}

// ─── Typography helpers ───────────────────────────────────────────

function ManifestoSectionTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h2
      style={{
        fontSize: 30,
        fontWeight: 800,
        margin: "44px 0 20px 0",
        letterSpacing: "-0.015em",
        lineHeight: 1.2,
        color: "#fafafa",
      }}
    >
      {children}
    </h2>
  );
}

function ManifestoBody({
  children,
  emphasized,
}: {
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <p
      style={{
        fontSize: emphasized ? 21 : 18,
        lineHeight: 1.75,
        color: emphasized ? "#fafafa" : "#e7e5e4",
        margin: "0 0 22px 0",
        fontWeight: emphasized ? 600 : 400,
        letterSpacing: emphasized ? "-0.005em" : 0,
      }}
    >
      {children}
    </p>
  );
}

function ManifestoDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        background: "#292524",
        margin: "44px 0",
      }}
    />
  );
}
