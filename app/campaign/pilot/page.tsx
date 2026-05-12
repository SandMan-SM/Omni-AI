// /campaign/pilot — Federation Pilot Wave announcement.
//
// Static, hand-authored. No DB fetches. The page reads like a letter to
// the 10 federation owners after the first test wave went out: this is
// what we're actually doing, here is the operating philosophy, here is
// the plan. Same cosmic background language as /manifesto so the page
// shares as both letter AND brand artifact.

import type { Metadata } from 'next';
import Link from 'next/link';
import { SpaceFieldBackdrop } from '@/components/space-field-backdrop';
import { CursorSpotlight } from '@/components/cursor-spotlight';
import { JsonLd, organizationSchema } from '@/components/json-ld';

export const metadata: Metadata = {
  title: 'Federation Pilot Wave · Omni AI',
  description:
    'The first federation wave was a test. Here is the plan. Ten domains, one system, time worked backwards from the outcome we already know is coming.',
  metadataBase: new URL('https://omnileadsagi.com'),
  alternates: { canonical: 'https://omnileadsagi.com/campaign/pilot' },
  openGraph: {
    title: 'Federation Pilot Wave · Omni AI',
    description:
      'Ten domains. One operating system. The work of building the system you do not have to survive.',
    url: 'https://omnileadsagi.com/campaign/pilot',
    siteName: 'Omni AI',
    type: 'article',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Federation Pilot Wave · Omni AI',
    description:
      'Ten domains. One operating system. The work of building the system you do not have to survive.',
  },
};

export default function PilotPage() {
  return (
    <main
      style={{
        background: '#050505',
        minHeight: '100vh',
        color: '#fafafa',
        fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <SpaceFieldBackdrop />
      <CursorSpotlight />
      <JsonLd data={organizationSchema} />

      <article
        style={{
          position: 'relative',
          maxWidth: 720,
          margin: '0 auto',
          padding: '96px 28px 120px',
          lineHeight: 1.75,
          fontSize: 19,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(251,191,36,0.10)',
            border: '1px solid rgba(251,191,36,0.30)',
            color: '#fbbf24',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#fbbf24' }} />
          Federation Pilot Wave · 2026-05-12
        </div>

        <h1
          style={{
            fontSize: 52,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: -1.5,
            margin: '0 0 28px',
            color: '#fff',
          }}
        >
          That wave was a test.{' '}
          <span style={{ color: '#fbbf24' }}>Here is the plan.</span>
        </h1>

        <p style={{ color: '#cfd3e0', margin: '0 0 28px' }}>
          You just received the first dispatch from a brand-new federation sending substrate.
          The copy was placeholder. The button pointed at a page that does not exist yet. That
          is intentional. What we needed to know was simple: can ten domains, freshly DKIM-signed,
          send personalized mail to the federation roster in one motion, with one-click
          unsubscribe, with bounce + complaint suppression wired before the first byte leaves the
          server. The answer came back yes. Now we build the part that matters.
        </p>

        <h2
          style={{
            fontSize: 24,
            margin: '48px 0 16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: 0.2,
            color: '#fff',
          }}
        >
          What is actually being built
        </h2>

        <p style={{ color: '#cfd3e0', margin: '0 0 20px' }}>
          Ten verified domains. One operating system. Each domain you own — Sacred Letters,
          Imperium Editorial, Love Thy Barber, Beehive Biz Pulse, Wasatch Post, Utah Main Street,
          Leifson Built, Youngs Cabinet, Alira Care, Psych &amp; Custody Evaluations — is now an
          arm of a single agentic infrastructure that:
        </p>
        <ul style={{ color: '#cfd3e0', paddingLeft: 22, margin: '0 0 28px' }}>
          <li style={{ marginBottom: 10 }}>
            Sends personalized, deliverability-safe email from a real human-named sender on the
            right domain to the audience that asked to hear from it.
          </li>
          <li style={{ marginBottom: 10 }}>
            Hosts a product landing page per offer at <code style={codeStyle}>/p/&lt;brand&gt;/&lt;slug&gt;</code>{' '}
            so every send has somewhere honest to land.
          </li>
          <li style={{ marginBottom: 10 }}>
            Holds a brand-deal funnel for outside sponsors — every approved prospect, no purchased
            lists, revenue split tracked at the row level.
          </li>
          <li style={{ marginBottom: 10 }}>
            Tracks opens, clicks, bounces, complaints, unsubs per send. Auto-pauses any domain
            that crosses the 5% bad-event threshold.
          </li>
          <li style={{ marginBottom: 10 }}>
            Logs every dispatch to the agentic dashboard so the operator sees one stream, not ten.
          </li>
        </ul>

        <h2
          style={{
            fontSize: 24,
            margin: '48px 0 16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#fff',
          }}
        >
          Time, worked backwards
        </h2>

        <p style={{ color: '#cfd3e0', margin: '0 0 20px' }}>
          We are not guessing at this. The outcome is already real to us — a federation of small
          businesses, each one fully alive in its own voice, all of them carrying each other's
          attention without anyone having to ask. That picture is fixed. The work of the next
          quarter is not to imagine the destination; it is to remove, week by week, the systems
          between us and the version of this network that already exists.
        </p>

        <p style={{ color: '#cfd3e0', margin: '0 0 20px' }}>
          Every test wave is a step back through time. The placeholder copy you got was a probe
          into the future: did the DKIM align, did the unsub headers stick, did the agentic
          dashboard mirror the send. It did. So today the placeholder is gone. Tomorrow the next
          layer comes off.
        </p>

        <p
          style={{
            color: '#fff',
            margin: '0 0 28px',
            fontSize: 22,
            lineHeight: 1.5,
            fontWeight: 600,
          }}
        >
          We are not here to help you manage your stress. We are here to dissolve the machinery
          that produces it.
        </p>

        <h2
          style={{
            fontSize: 24,
            margin: '48px 0 16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#fff',
          }}
        >
          What happens next
        </h2>

        <ol style={{ color: '#cfd3e0', paddingLeft: 22, margin: '0 0 28px' }}>
          <li style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>This week.</strong> One real product landing per
            domain. Real copy, real CTA, real Stripe / booking / contact link behind it. Sacred
            Letters first, because it is daily; the others follow.
          </li>
          <li style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>Next.</strong> Brand-deal funnels light up. Apollo
            discovery drops candidate sponsors into a queue; nothing leaves the system without
            operator approval per row. Revenue share is visible on every brand-deal page.
          </li>
          <li style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>Then.</strong> Cross-promotion gets agentic — the
            Pantheon decides which creative each property shows, scored on what actually converts,
            re-balanced nightly.
          </li>
          <li style={{ marginBottom: 12 }}>
            <strong style={{ color: '#fff' }}>Always.</strong> If you ever do not want any of
            these emails, the unsubscribe link at the bottom of every send is one click. We honor
            it instantly. The system is built so attention is given, never taken.
          </li>
        </ol>

        <div
          style={{
            marginTop: 56,
            padding: 24,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div
            style={{
              color: '#9ba2b8',
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              marginBottom: 8,
            }}
          >
            Reply to
          </div>
          <a
            href="mailto:sitanim8@gmail.com?subject=Federation%20Pilot"
            style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 600 }}
          >
            sitanim8@gmail.com
          </a>
          <p
            style={{
              color: '#9ba2b8',
              fontSize: 14,
              marginTop: 8,
              marginBottom: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Anything you want surfaced, sponsored, paused, or amplified — say it here. Replies go
            straight to the operator, not a queue.
          </p>
        </div>

        <p
          style={{
            color: '#9ba2b8',
            margin: '40px 0 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 14,
          }}
        >
          The full philosophy: <Link href="/manifesto" style={{ color: '#fbbf24' }}>The Interlinked Manifesto</Link>.
        </p>
      </article>
    </main>
  );
}

const codeStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 14,
};
