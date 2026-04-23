import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
// Adds the full-site footer (logo, 6 nav links, tagline, copyright + privacy).
// The in-body "See also: About · FAQ" block stays — it's redundant with the
// footer but the inline one helps readers who scroll to the bottom of a long
// legal page without needing to hunt for navigation.
import { Footer } from "@/components/footer";

// Human-readable effective date + ISO for JSON-LD. If you materially
// change the practices below, bump both of these.
const EFFECTIVE_DATE_HUMAN = "April 23, 2026";
const EFFECTIVE_DATE_ISO = "2026-04-23";

export const metadata: Metadata = {
  title: "Privacy Policy | Omni AI",
  description:
    "How Omni AI collects, uses, stores, and shares personal information — plus your rights over your data and how to contact us.",
  alternates: { canonical: "https://omnileadsagi.com/privacy" },
  openGraph: {
    title: "Privacy Policy | Omni AI",
    description:
      "How Omni AI collects, uses, stores, and shares personal information — plus your rights over your data.",
    url: "https://omnileadsagi.com/privacy",
    siteName: "Omni AI",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Omni AI",
    description:
      "How Omni AI collects, uses, stores, and shares personal information.",
  },
  robots: { index: true, follow: true },
};

// Chrome-gold gradient used on the section headings so the privacy
// page shares the brand identity with /book-now, /about, and the
// newsletter CTAs without leaning on heavy decoration.
const CHROME_GOLD =
  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)";

const goldTextStyle = {
  backgroundImage: CHROME_GOLD,
  WebkitBackgroundClip: "text" as const,
  backgroundClip: "text" as const,
  WebkitTextFillColor: "transparent" as const,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-white">
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/omni-logo.svg"
              alt="Omni AI"
              width={28}
              height={28}
              priority
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold text-gradient">Omni AI</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Back home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-16 md:py-24">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-3">
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Privacy <span style={goldTextStyle}>Policy</span>
          </h1>
          <p className="text-sm text-gray-500">
            Effective{" "}
            <time dateTime={EFFECTIVE_DATE_ISO}>{EFFECTIVE_DATE_HUMAN}</time>
          </p>
        </div>

        <div className="space-y-10 text-gray-300 leading-relaxed">
          <section>
            <p>
              This policy explains what Omni AI (&ldquo;Omni AI,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects when you use{" "}
              <span className="text-white">omnileadsagi.com</span> and any
              product or service we operate under the Omni AI brand
              (collectively, the &ldquo;Service&rdquo;), how we use it, who we
              share it with, and the rights you have over it. Omni AI is
              operated by Sitani Mafi. You can reach us at{" "}
              <a
                href="mailto:sitanim8@gmail.com"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                sitanim8@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Information we collect
            </h2>
            <p className="mb-4">
              We only collect what we need to run the Service, answer the
              requests you send us, and improve the product. Specifically:
            </p>
            <ul className="space-y-3 list-disc pl-6">
              <li>
                <span className="text-white font-semibold">
                  Information you give us directly.
                </span>{" "}
                Your name, email address, phone number, business name, and any
                notes you enter into a lead form, newsletter sign-up,
                sign-in/sign-up form, booking flow, or contact email. If you
                create an account, we also store the username and password
                you choose (passwords are stored hashed — we never see them in
                plain text).
              </li>
              <li>
                <span className="text-white font-semibold">
                  Payment information.
                </span>{" "}
                When you purchase Interlinked Premium or any other paid
                offering, you enter your card details on a Stripe-hosted
                checkout page. Stripe processes and stores your card data. We
                receive from Stripe only the limited subscription metadata we
                need to grant access (plan, status, customer ID, renewal
                dates) — never your full card number.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Usage and device information.
                </span>{" "}
                When you visit the Service we automatically log the pages you
                view, the buttons and links you click, the forms you submit,
                the URL that referred you, your UTM tags, your approximate
                viewport size, your user-agent string, and the timestamp of
                each event. We do this with two identifiers: a persistent
                visitor ID stored in your browser&rsquo;s localStorage, and a
                per-tab session ID stored in sessionStorage. These are random
                strings — they don&rsquo;t include your name or email unless
                you have also signed in.
              </li>
              <li>
                <span className="text-white font-semibold">
                  IP address.
                </span>{" "}
                Vercel, our hosting provider, receives your IP address as part
                of every request you make. We use this for security, abuse
                prevention, and rough geographic analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              How we use it
            </h2>
            <ul className="space-y-3 list-disc pl-6">
              <li>
                <span className="text-white font-semibold">Deliver the Service</span>
                {" "}— sign you in, route leads to the right inbox, process
                payments, send booking confirmations, grant access to premium
                content, and keep the site running.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Communicate with you
                </span>{" "}
                — reply to the messages and demo requests you send us, send the
                newsletter you signed up for, notify you about account or
                billing changes, and (if you ask for a strategy call) schedule
                and prepare for it. Marketing and transactional emails are
                clearly distinguishable; marketing email always contains a
                one-click unsubscribe link.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Improve the product
                </span>{" "}
                — analyze which pages, CTAs, and campaigns perform, fix bugs,
                and prioritize what to build next. Product analytics are
                aggregated internally and never sold.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Protect the Service
                </span>{" "}
                — detect abuse, fraud, scraping, and policy violations, and
                cooperate with lawful requests from authorities when we are
                legally required to.
              </li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Who we share it with
            </h2>
            <p className="mb-4">
              We do not sell your personal information. We share it only with
              the service providers we need to run the Service, and only to
              the extent they need to do their job:
            </p>
            <ul className="space-y-3 list-disc pl-6">
              <li>
                <span className="text-white font-semibold">Supabase</span> —
                our database and authentication host. Stores profiles, leads,
                newsletter subscribers, bookings, and event logs.
              </li>
              <li>
                <span className="text-white font-semibold">Stripe</span> —
                payment processor. Handles all card data end-to-end. See{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <span className="text-white font-semibold">Resend</span> — our
                transactional and newsletter email provider. Receives the
                email address and name we need to deliver the message.
              </li>
              <li>
                <span className="text-white font-semibold">Vercel</span> — our
                web host. Terminates TLS and serves the site.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Legal and safety recipients
                </span>{" "}
                — courts, regulators, or law enforcement if we receive a valid
                legal request, or if we believe disclosure is necessary to
                prevent fraud or harm.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Successor entities
                </span>{" "}
                — if Omni AI is acquired or merged, your information may be
                transferred to the successor as part of that transaction.
                We&rsquo;ll post a notice on this page if that happens.
              </li>
            </ul>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Cookies and browser storage
            </h2>
            <p className="mb-4">
              We don&rsquo;t use third-party advertising cookies. We do use
              the following:
            </p>
            <ul className="space-y-3 list-disc pl-6">
              <li>
                <span className="text-white font-semibold">
                  omni_visitor_id
                </span>{" "}
                (localStorage, long-lived) — a random identifier so we can
                count unique visitors.
              </li>
              <li>
                <span className="text-white font-semibold">
                  omni_session_id
                </span>{" "}
                (sessionStorage, cleared when you close the tab) — a random
                identifier so we can group events into sessions.
              </li>
              <li>
                <span className="text-white font-semibold">omni_user</span>{" "}
                (localStorage, only after you sign in) — your signed-in
                profile summary so we don&rsquo;t re-authenticate on every
                page load. Clearing it is equivalent to signing out.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Supabase auth cookies
                </span>{" "}
                — short-lived tokens that keep your session secure.
              </li>
              <li>
                <span className="text-white font-semibold">Stripe cookies</span>{" "}
                — Stripe sets its own cookies on its checkout pages for fraud
                prevention. Stripe&rsquo;s privacy policy governs those.
              </li>
            </ul>
            <p className="mt-4">
              You can clear any of these from your browser settings at any
              time. Clearing them will sign you out and reset your analytics
              identifiers.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Retention
            </h2>
            <p>
              We keep your information for as long as your account is active
              or as long as we need it to provide the Service. Lead and
              booking records are retained for up to 24 months for business
              continuity and legal defense. Event analytics are retained for
              up to 18 months. Billing records (including invoices Stripe
              issues on our behalf) are retained for the period required by
              U.S. tax and accounting law, typically at least 7 years. After
              the applicable retention window, we delete or anonymize the
              data.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Your rights
            </h2>
            <p className="mb-4">
              Depending on where you live (California, the EU/UK, and several
              U.S. states explicitly grant these; we extend them to everyone),
              you have the right to:
            </p>
            <ul className="space-y-2 list-disc pl-6">
              <li>Access the personal information we hold about you.</li>
              <li>Correct information that is inaccurate or incomplete.</li>
              <li>Delete your information, subject to the retention rules above.</li>
              <li>
                Opt out of marketing email (use the unsubscribe link or reply
                &ldquo;unsubscribe&rdquo;).
              </li>
              <li>Export a machine-readable copy of your information.</li>
              <li>
                Object to or restrict certain processing, including any
                automated decision-making.
              </li>
              <li>Lodge a complaint with a data-protection authority.</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email{" "}
              <a
                href="mailto:sitanim8@gmail.com"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                sitanim8@gmail.com
              </a>{" "}
              from the email address associated with your account. We will
              respond within 30 days.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Security
            </h2>
            <p>
              We use TLS in transit, encrypted storage at rest, hashed
              passwords, and access controls on our production systems. No
              system is perfectly secure; if we discover a breach that
              materially affects you, we will notify you as required by
              applicable law.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              International transfers
            </h2>
            <p>
              Our providers (Supabase, Stripe, Resend, Vercel) operate
              globally, including in the United States. By using the Service
              from outside the U.S., you consent to your information being
              processed in the U.S. and in other jurisdictions where our
              providers operate. Where required, our providers offer standard
              contractual clauses or equivalent safeguards.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Children
            </h2>
            <p>
              The Service is not directed at children under 13 and we do not
              knowingly collect personal information from children under 13.
              If you believe a child under 13 has given us personal
              information, please email us and we will delete it.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Changes to this policy
            </h2>
            <p>
              When we make material changes we will update the effective date
              at the top of this page and — for significant changes — post a
              notice on the home page or email registered users. Your
              continued use of the Service after the effective date means you
              accept the updated policy.
            </p>
          </section>

          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={goldTextStyle}
            >
              Contact
            </h2>
            <p>
              Questions, requests, or complaints? Email Sitani Mafi,
              founder, at{" "}
              <a
                href="mailto:sitanim8@gmail.com"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                sitanim8@gmail.com
              </a>
              . Include &ldquo;Privacy&rdquo; in the subject so we can route
              it correctly.
            </p>
          </section>

          <div className="pt-8 border-t border-white/5">
            <p className="text-sm text-gray-500">
              See also:{" "}
              <Link
                href="/about"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                About Omni AI
              </Link>
              {" · "}
              <Link
                href="/faq"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                FAQ
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
