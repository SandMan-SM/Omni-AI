"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Phone,
  Search,
  Sparkles,
  Unplug,
  User,
  X,
} from "lucide-react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

type Offer = {
  key: string;
  eyebrow: string;
  title: string;
  price: string;
  summary: string;
  backHeadline: string;
  backCopy: string;
  details: { title: string; copy: string }[];
  urgency: string;
  image: string;
  imageAlt: string;
  icon: typeof Sparkles;
  accent: string;
  spotsAvailable: number;
  compact?: boolean;
  locked?: boolean;
  seoPrices?: { label: string; value: string }[];
};

const offers: Offer[] = [
  {
    key: "meta-ai-advertising",
    eyebrow: "Campaign",
    title: "Meta AI Advertising",
    price: "$1,500",
    summary:
      "A focused Meta advertising system built to find, test, and scale the audiences that move.",
    backHeadline: "Stop guessing what your next customer will click.",
    backCopy:
      "We build the campaign system around your revenue goal, then keep improving it as real performance data comes in.",
    details: [
      {
        title: "Launch with a clear plan",
        copy: "Structure, audiences, offers, and creative aligned to one measurable revenue goal.",
      },
      {
        title: "Find winners faster",
        copy: "AI-assisted tests reveal what earns attention before wasted spend compounds.",
      },
      {
        title: "Protect every dollar",
        copy: "Underperformers are cut and budget moves toward stronger signals.",
      },
      {
        title: "See what drives results",
        copy: "Reporting connects spend, leads, and the next decision.",
      },
    ],
    urgency: "Limited onboarding capacity. Reserve a fit review with no commitment.",
    image: "/service/meta-ai-advertising/meta-ai-campaign.jpg",
    imageAlt:
      "AI campaign engine connecting audience groups to optimized advertising creative",
    icon: Sparkles,
    accent: "from-purple-500/30 via-fuchsia-500/10 to-transparent",
    spotsAvailable: 4,
  },
  {
    key: "meta-ai-advertising-api",
    eyebrow: "Connected",
    title: "Meta AI Advertising + API Integration",
    price: "$2,500",
    summary:
      "Connect the ad account to cleaner conversion data so Meta can optimize from better signals.",
    backHeadline: "Give Meta the conversion signals it has been missing.",
    backCopy:
      "Browser tracking alone loses data. This package adds a server-side signal path so optimization is based on a more complete view of real leads.",
    details: [
      {
        title: "Everything in Advertising",
        copy: "Strategy, creative testing, management, optimization, and reporting.",
      },
      {
        title: "Recover missing signals",
        copy: "Conversion API captures key events when browser tracking falls short.",
      },
      {
        title: "Improve lead attribution",
        copy: "Server-side events connect qualified actions to the campaigns that created them.",
      },
      {
        title: "Train smarter optimization",
        copy: "Cleaner matching helps Meta find more people like your converters.",
      },
    ],
    urgency: "Best for businesses ready to make paid media measurable and scalable.",
    image: "/service/meta-ai-advertising/meta-ai-api.jpg",
    imageAlt:
      "Secure conversion data bridge connecting an advertising campaign to a server",
    icon: Unplug,
    accent: "from-blue-500/30 via-cyan-500/10 to-transparent",
    spotsAvailable: 5,
  },
  {
    key: "meta-ai-advertising-api-crm",
    eyebrow: "Full system",
    title: "Meta AI + API + CRM (SMS, Email)",
    price: "$3,500",
    summary:
      "The complete acquisition and follow-up loop, including automated SMS and email.",
    backHeadline: "Turn every paid click into an immediate follow-up.",
    backCopy:
      "Speed-to-lead changes conversion. This package connects the ad, the data, and the response system so qualified prospects do not sit untouched.",
    details: [
      {
        title: "Capture every new lead",
        copy: "Lead details flow into one structured CRM pipeline.",
      },
      {
        title: "Respond while intent is high",
        copy: "Automated SMS and email begin the conversation immediately.",
      },
      {
        title: "Route the right opportunity",
        copy: "Qualified leads reach the right person with the right context.",
      },
      {
        title: "See the full journey",
        copy: "Track ad click, lead, conversation, and sales outcome together.",
      },
    ],
    urgency: "The highest-leverage option for teams losing leads after the click.",
    image: "/service/meta-ai-advertising/meta-ai-crm.jpg",
    imageAlt:
      "Connected advertising, CRM, SMS, and email automation system",
    icon: MessageSquareText,
    accent: "from-amber-400/30 via-orange-500/10 to-transparent",
    spotsAvailable: 3,
  },
  {
    key: "seo-first-11",
    eyebrow: "First 11",
    title: "SEO",
    price: "Founding allocation",
    summary:
      "Three defined entry points for the first 11 businesses accepted into the SEO program.",
    backHeadline: "Own the searches that already carry buying intent.",
    backCopy:
      "Choose the market footprint you need now. Every level is built to turn search visibility into qualified demand—not vanity traffic.",
    details: [
      {
        title: "Local · $3K",
        copy: "Win priority service areas with local search architecture and conversion-focused pages.",
      },
      {
        title: "Regional · $4K",
        copy: "Expand across multiple markets with scalable service-area content and authority.",
      },
      {
        title: "National · $5K",
        copy: "Build category visibility with technical foundations, content clusters, and authority.",
      },
    ],
    urgency: "Founding pricing is reserved for the first 11 accepted businesses.",
    image: "/service/meta-ai-advertising/seo-reach.jpg",
    imageAlt:
      "Search visibility expanding from a local city to regional and national reach",
    icon: Search,
    accent: "from-emerald-500/25 via-teal-500/10 to-transparent",
    spotsAvailable: 6,
    compact: true,
    seoPrices: [
      { label: "L", value: "$3K" },
      { label: "R", value: "$4K" },
      { label: "N", value: "$5K" },
    ],
  },
  {
    key: "legacy",
    eyebrow: "Private access",
    title: "Legacy",
    price: "Locked",
    summary:
      "Legacy capacity is currently closed. Reserve interest to be considered if access reopens.",
    backHeadline: "Protected systems. Invitation-only access.",
    backCopy:
      "Legacy engagements are intentionally limited to preserve continuity, depth, and the standard of work inside each partnership.",
    details: [
      {
        title: "Continuity over volume",
        copy: "Existing relationships and long-horizon systems keep protected capacity.",
      },
      {
        title: "Private review only",
        copy: "New opportunities are considered for strategic fit and available bandwidth.",
      },
      {
        title: "Priority consideration",
        copy: "A reservation records your interest and places you first in line if a suitable opening appears.",
      },
    ],
    urgency: "No public enrollment. Reserve interest for priority review.",
    image: "/service/meta-ai-advertising/legacy-vault.jpg",
    imageAlt: "Luxury technology vault representing protected legacy access",
    icon: LockKeyhole,
    accent: "from-zinc-500/20 via-zinc-400/5 to-transparent",
    spotsAvailable: 0,
    compact: true,
    locked: true,
  },
];

function OfferCard({
  offer,
  flipped,
  onFlip,
  onReserve,
}: {
  offer: Offer;
  flipped: boolean;
  onFlip: () => void;
  onReserve: () => void;
}) {
  const Icon = offer.icon;
  const height = offer.compact
    ? "aspect-[3/4] h-auto lg:aspect-auto lg:h-[560px]"
    : "aspect-[3/4] h-auto";

  return (
    <article
      className={`${height} min-w-0 [perspective:1400px]`}
      aria-label={`${offer.title} service card`}
    >
      <div
        className={`relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div
          className={`absolute inset-0 flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/85 shadow-2xl shadow-black/30 backdrop-blur-xl [backface-visibility:hidden] ${
            offer.compact ? "p-5 lg:p-7" : "p-5"
          }`}
          aria-hidden={flipped}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-br ${offer.accent}`}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                  {offer.eyebrow}
                </span>
                <span
                  className={`mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    offer.spotsAvailable > 0 ? "text-amber-200" : "text-zinc-400"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      offer.spotsAvailable > 0 ? "bg-amber-300" : "bg-zinc-500"
                    }`}
                  />
                  {offer.spotsAvailable > 0
                    ? `Only ${offer.spotsAvailable} spots available`
                    : "Waitlist only"}
                </span>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>

            <div
              className={`relative mt-4 overflow-hidden rounded-2xl border border-white/10 ${
                offer.compact ? "h-24 lg:h-28" : "h-24"
              }`}
            >
              <Image
                src={offer.image}
                alt={offer.imageAlt}
                fill
                sizes={offer.compact ? "(min-width: 768px) 40vw, 90vw" : "(min-width: 1024px) 30vw, 90vw"}
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent"
              />
            </div>

            <h2 className={`${offer.compact ? "mt-3 text-2xl leading-tight lg:mt-5 lg:text-3xl" : "mt-3 text-2xl leading-tight"} font-semibold tracking-tight text-white`}>
              {offer.title}
            </h2>

            {offer.seoPrices ? (
              <div className="mt-3 grid grid-cols-3 gap-2 lg:mt-5">
                {offer.seoPrices.map((tier) => (
                  <div
                    key={tier.label}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
                      {tier.label}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-white">{tier.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${offer.compact ? "mt-3 text-2xl lg:mt-4" : "mt-3 text-3xl"} font-semibold tracking-tight text-white`}>
                {offer.locked ? (
                  <span className="inline-flex items-center gap-2 text-zinc-300">
                    <LockKeyhole className="h-5 w-5" aria-hidden />
                    {offer.price}
                  </span>
                ) : (
                  offer.price
                )}
              </div>
            )}

            <p className={`${offer.compact ? "mt-2 leading-snug lg:mt-4 lg:leading-relaxed" : "mt-2 leading-snug"} text-sm text-zinc-300`}>
              {offer.summary}
            </p>

            <div className={`mt-auto grid grid-cols-2 gap-3 ${offer.compact ? "pt-3 lg:pt-6" : "pt-3"}`}>
              <button
                type="button"
                onClick={onReserve}
                tabIndex={flipped ? -1 : 0}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-black transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                Reserve Spot
              </button>
              <button
                type="button"
                onClick={onFlip}
                aria-pressed={flipped}
                tabIndex={flipped ? -1 : 0}
                className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                Learn More
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`absolute inset-0 flex h-full flex-col rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl shadow-black/40 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            offer.compact ? "overflow-y-auto p-5 lg:overflow-hidden lg:p-7" : "overflow-y-auto p-5"
          }`}
          aria-hidden={!flipped}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-purple-300">
              Why it converts
            </span>
            <Icon className="h-5 w-5 text-white/70" aria-hidden />
          </div>
          <h3 className={`${offer.compact ? "mt-3 text-xl lg:mt-4 lg:text-2xl" : "mt-3 text-xl"} font-semibold tracking-tight text-white`}>
            {offer.backHeadline}
          </h3>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            {offer.backCopy}
          </p>
          <ul className={`${offer.compact ? "mt-3 space-y-2 lg:mt-4 lg:space-y-2.5" : "mt-3 space-y-2"}`}>
            {offer.details.map((detail) => (
              <li key={detail.title} className="flex gap-2.5 text-xs leading-snug text-zinc-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                <span>
                  <strong className="font-semibold text-white">{detail.title}.</strong>{" "}
                  {detail.copy}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-auto border-t border-white/10 pt-3 text-xs font-medium leading-relaxed text-purple-200">
            {offer.urgency}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              type="button"
              onClick={onFlip}
              tabIndex={flipped ? 0 : -1}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Overview
            </button>
            <button
              type="button"
              onClick={onReserve}
              tabIndex={flipped ? 0 : -1}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-black transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              Reserve Spot
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ReservationModal({
  offer,
  onClose,
}: {
  offer: Offer;
  onClose: () => void;
}) {
  const [fields, setFields] = useState({ name: "", phone: "", email: "" });
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!fields.name.trim() || !fields.phone.trim() || !fields.email.trim()) {
      setError("Please complete all three fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          website,
          source: "meta_ai_service_reservation",
          role: offer.title,
          message: `Requested offer: ${offer.title} (${offer.price})`,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "We could not save your reservation.",
        );
      }
      setStatus("success");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Something went wrong. Please try again.",
      );
      setStatus("idle");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-purple-950/30 sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-transparent"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reservation form"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-zinc-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {status === "success" ? (
          <div className="relative py-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
              <Check className="h-8 w-8" aria-hidden />
            </span>
            <h2 id="reservation-title" className="mt-6 text-3xl font-semibold text-white">
              Your spot is reserved.
            </h2>
            <p className="mt-3 text-zinc-400">
              We received your interest in {offer.title}. The Omni AI team will follow up with next steps.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-7 min-h-12 rounded-xl bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-purple-300">
              Reserve your spot
            </p>
            <h2 id="reservation-title" className="mt-3 pr-12 text-3xl font-semibold tracking-tight text-white">
              {offer.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Send your contact details and we&apos;ll reach out to confirm fit, timing, and next steps.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] h-px w-px overflow-hidden"
              >
                <label htmlFor={`website-${offer.key}`}>Website</label>
                <input
                  id={`website-${offer.key}`}
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              <label className="relative block">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" aria-hidden />
                <span className="sr-only">Full name</span>
                <input
                  autoFocus
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Full name"
                  value={fields.name}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={status === "sending"}
                  className="min-h-14 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-12 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/60 focus:bg-white/[0.09] disabled:opacity-50"
                />
              </label>

              <label className="relative block">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" aria-hidden />
                <span className="sr-only">Phone number</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  placeholder="Phone number"
                  value={fields.phone}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, phone: event.target.value }))
                  }
                  disabled={status === "sending"}
                  className="min-h-14 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-12 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/60 focus:bg-white/[0.09] disabled:opacity-50"
                />
              </label>

              <label className="relative block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" aria-hidden />
                <span className="sr-only">Email address</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={fields.email}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, email: event.target.value }))
                  }
                  disabled={status === "sending"}
                  className="min-h-14 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-12 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/60 focus:bg-white/[0.09] disabled:opacity-50"
                />
              </label>

              {error ? (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-5 font-semibold text-white transition hover:from-purple-400 hover:to-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "sending" ? "Reserving..." : "Reserve Spot"}
                {status !== "sending" ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : null}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export function MetaAiAdvertisingClient() {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [primarySlide, setPrimarySlide] = useState(0);
  const [compactSlide, setCompactSlide] = useState(0);
  const primaryCarouselRef = useRef<HTMLDivElement>(null);
  const compactCarouselRef = useRef<HTMLDivElement>(null);

  const primaryOffers = offers.filter((offer) => !offer.compact);
  const compactOffers = offers.filter((offer) => offer.compact);

  const goToPrimarySlide = (nextSlide: number) => {
    const carousel = primaryCarouselRef.current;
    const target = carousel?.children[nextSlide] as HTMLElement | undefined;

    if (carousel && target) {
      carousel.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
      setPrimarySlide(nextSlide);
    }
  };

  const movePrimaryCarousel = (direction: -1 | 1) => {
    goToPrimarySlide(
      Math.min(
        primaryOffers.length - 1,
        Math.max(0, primarySlide + direction),
      ),
    );
  };

  const goToCompactSlide = (nextSlide: number) => {
    const carousel = compactCarouselRef.current;
    const target = carousel?.children[nextSlide] as HTMLElement | undefined;

    if (carousel && target) {
      carousel.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
      setCompactSlide(nextSlide);
    }
  };

  const moveCompactCarousel = (direction: -1 | 1) => {
    goToCompactSlide(
      Math.min(
        compactOffers.length - 1,
        Math.max(0, compactSlide + direction),
      ),
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <Navbar />

      <main>
        <section className="relative flex min-h-[720px] items-center overflow-hidden border-b border-white/10 px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-40 lg:min-h-[790px]">
          <Image
            src="/service/meta-ai-advertising/meta-ecosystem-hero-apps.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[64%_center] sm:object-center"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.88)_34%,rgba(0,0,0,0.38)_66%,rgba(0,0,0,0.18)_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,transparent_32%,rgba(0,0,0,0.48)_100%)]"
          />
          <div className="relative mx-auto w-full max-w-7xl">
            <div className="max-w-2xl text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-purple-300">
                Omni AI Services
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-[-0.04em] text-white drop-shadow-2xl sm:text-6xl xl:text-7xl">
                Turn Meta attention into{" "}
                <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300 bg-clip-text text-transparent">
                  action.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-300 drop-shadow-lg sm:text-lg">
                Start with intelligent advertising, connect the conversion data, or build the full follow-up system from ad click to SMS and email.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-300" aria-hidden />
                  Focused packages
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-300" aria-hidden />
                  Connected data
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-300" aria-hidden />
                  Automated follow-up
                </span>
              </div>

              <a
                href="/book-now"
                className="mt-9 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-7 text-sm font-semibold text-white shadow-xl shadow-blue-950/40 transition hover:from-purple-400 hover:to-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                <CalendarDays className="h-5 w-5" aria-hidden />
                Schedule Consultation
              </a>

            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
                  Choose your system
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  Swipe to compare · {primarySlide + 1} of {primaryOffers.length}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => movePrimaryCarousel(-1)}
                  disabled={primarySlide === 0}
                  aria-label="Previous service"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => movePrimaryCarousel(1)}
                  disabled={primarySlide === primaryOffers.length - 1}
                  aria-label="Next service"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <div
              ref={primaryCarouselRef}
              onScroll={(event) => {
                if (window.innerWidth >= 1024) return;
                const carousel = event.currentTarget;
                const slides = Array.from(carousel.children) as HTMLElement[];
                const closest = slides.reduce(
                  (best, slide, index) => {
                    const distance = Math.abs(slide.offsetLeft - carousel.scrollLeft);
                    return distance < best.distance ? { index, distance } : best;
                  },
                  { index: 0, distance: Number.POSITIVE_INFINITY },
                );
                setPrimarySlide(closest.index);
              }}
              className="relative -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0"
              aria-label="Meta advertising service carousel"
            >
              {primaryOffers.map((offer) => (
                <div
                  key={offer.key}
                  className="w-[90vw] max-w-[430px] shrink-0 snap-center sm:w-[70vw] lg:w-auto lg:max-w-none lg:shrink"
                >
                  <OfferCard
                    offer={offer}
                    flipped={Boolean(flipped[offer.key])}
                    onFlip={() =>
                      setFlipped((current) => ({
                        ...current,
                        [offer.key]: !current[offer.key],
                      }))
                    }
                    onReserve={() => setSelectedOffer(offer)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-1 flex items-center justify-center gap-2 lg:hidden" aria-label="Primary carousel position">
              {primaryOffers.map((offer, index) => (
                <button
                  key={offer.key}
                  type="button"
                  onClick={() => goToPrimarySlide(index)}
                  aria-label={`Go to service ${index + 1}`}
                  aria-current={primarySlide === index ? "true" : undefined}
                  className="flex h-8 items-center justify-center px-1"
                >
                  <span
                    className={`h-2 rounded-full transition-all ${
                      primarySlide === index
                        ? "w-7 bg-gradient-to-r from-purple-400 to-blue-400"
                        : "w-2 bg-white/25"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="mx-auto mt-6 max-w-5xl">
              <div className="mb-4 flex items-center justify-between lg:hidden">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
                    More ways to grow
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Swipe to compare · {compactSlide + 1} of {compactOffers.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveCompactCarousel(-1)}
                    disabled={compactSlide === 0}
                    aria-label="Previous additional service"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCompactCarousel(1)}
                    disabled={compactSlide === compactOffers.length - 1}
                    aria-label="Next additional service"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>

              <div
                ref={compactCarouselRef}
                onScroll={(event) => {
                  if (window.innerWidth >= 1024) return;
                  const carousel = event.currentTarget;
                  const slides = Array.from(carousel.children) as HTMLElement[];
                  const closest = slides.reduce(
                    (best, slide, index) => {
                      const distance = Math.abs(slide.offsetLeft - carousel.scrollLeft);
                      return distance < best.distance ? { index, distance } : best;
                    },
                    { index: 0, distance: Number.POSITIVE_INFINITY },
                  );
                  setCompactSlide(closest.index);
                }}
                className="relative -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0"
                aria-label="Additional service carousel"
              >
                {compactOffers.map((offer) => (
                  <div
                    key={offer.key}
                    className="w-[90vw] max-w-[430px] shrink-0 snap-center sm:w-[70vw] lg:w-auto lg:max-w-none lg:shrink"
                  >
                    <OfferCard
                      offer={offer}
                      flipped={Boolean(flipped[offer.key])}
                      onFlip={() =>
                        setFlipped((current) => ({
                          ...current,
                          [offer.key]: !current[offer.key],
                        }))
                      }
                      onReserve={() => setSelectedOffer(offer)}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-1 flex items-center justify-center gap-2 lg:hidden" aria-label="Additional carousel position">
                {compactOffers.map((offer, index) => (
                  <button
                    key={offer.key}
                    type="button"
                    onClick={() => goToCompactSlide(index)}
                    aria-label={`Go to additional service ${index + 1}`}
                    aria-current={compactSlide === index ? "true" : undefined}
                    className="flex h-8 items-center justify-center px-1"
                  >
                    <span
                      className={`h-2 rounded-full transition-all ${
                        compactSlide === index
                          ? "w-7 bg-gradient-to-r from-purple-400 to-blue-400"
                          : "w-2 bg-white/25"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {selectedOffer ? (
        <ReservationModal
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
        />
      ) : null}
    </div>
  );
}
