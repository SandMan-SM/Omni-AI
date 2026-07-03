import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";

export const metadata: Metadata = {
  title: "Subscribe — Omni AI",
  description:
    "Join the Omni AI list for autonomous-systems intel, new releases, and field updates from the front lines of agentic infrastructure.",
  alternates: { canonical: "https://omnileadsagi.com/subscribe" },
  openGraph: {
    title: "Subscribe — Omni AI",
    description:
      "Autonomous-systems intel, new releases, and field updates — straight to your inbox.",
    url: "https://omnileadsagi.com/subscribe",
    siteName: "Omni AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subscribe — Omni AI",
    description:
      "Autonomous-systems intel, new releases, and field updates — straight to your inbox.",
  },
  robots: { index: true, follow: true },
};

export default function SubscribePage() {
  return (
    <main className="fixed inset-0 z-[60] overflow-hidden bg-[hsl(var(--background))]">
      {/* On-brand dark gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_18%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(ellipse_60%_50%_at_50%_100%,hsl(var(--secondary)/0.12),transparent_65%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative flex h-full w-full flex-col items-center justify-center px-6 py-10">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Omni AI home"
          className="mb-10 inline-flex items-center gap-2 opacity-90 transition-opacity hover:opacity-100"
        >
          <Image
            src="/omni-logo.svg"
            alt="Omni AI"
            width={44}
            height={44}
            priority
          />
          <span className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Omni AI
          </span>
        </Link>

        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          {/* Kicker */}
          <span className="mb-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--accent))]">
            Join Free
          </span>

          {/* Headline */}
          <h1 className="text-balance text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-5xl md:text-6xl">
            Intel from autonomous systems.
          </h1>

          {/* Description */}
          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
            New releases, agentic-infrastructure intel, and field updates from
            the systems that generate leads and run operations 24/7.
            <br className="hidden sm:block" />
            One signal-dense email. No noise, no fluff.
          </p>

          {/* Form */}
          <div className="mt-10 flex w-full justify-center">
            <SubscribeForm />
          </div>
        </div>
      </div>
    </main>
  );
}
