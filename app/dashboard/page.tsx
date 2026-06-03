"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Compass,
  Eye,
  Layers3,
  LogOut,
  Orbit,
  Shield,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { DocumentSignature } from "@/components/document-signature";
import { useAuth } from "@/hooks/use-auth";

const definitions = [
  {
    term: "Program",
    body: "A chosen pattern repeated until it becomes automatic. If you do not choose it, the world will choose one for you.",
  },
  {
    term: "Signal",
    body: "A piece of reality asking for attention. Signal is usually quiet, specific, and inconvenient.",
  },
  {
    term: "Noise",
    body: "Anything that consumes attention without improving perception, decision, action, or love.",
  },
  {
    term: "Loop",
    body: "A recurring sequence of thought, emotion, behavior, and consequence. Most people call loops personality.",
  },
  {
    term: "Agency",
    body: "The ability to interrupt a loop, choose a direction, and move before the old self negotiates you back down.",
  },
  {
    term: "Integration",
    body: "When knowledge stops being information and becomes behavior. The body knows it, not just the mind.",
  },
  {
    term: "Leverage",
    body: "A force multiplier. Tools, systems, memory, capital, code, reputation, and people are leverage when they compound judgment.",
  },
  {
    term: "The Library",
    body: "The total archive of lived experience, pattern, language, failure, recovery, and wisdom that the Program learns from.",
  },
];

const practices = [
  "Tell the truth quickly.",
  "Protect your attention like it is your bloodstream.",
  "Do the thing that makes tomorrow lighter.",
  "Treat fear as a messenger, not a king.",
  "Build systems around the behavior you want repeated.",
  "Make your calendar prove your values.",
  "Let data correct your story.",
  "Leave every room clearer than you found it.",
];

function SkeletonGate() {
  return (
    <main className="min-h-screen bg-[#050506] px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="h-10 w-36 rounded-lg bg-white/[0.06]" />
        <div className="mt-12 h-72 rounded-lg border border-white/10 bg-white/[0.03] sm:mt-20" />
      </div>
    </main>
  );
}

function OmniLoopVisual() {
  const steps = [
    { label: "Observe", icon: Eye },
    { label: "Discern", icon: Compass },
    { label: "Act", icon: Target },
    { label: "Integrate", icon: Brain },
  ];

  return (
    <div className="relative overflow-hidden rounded-lg border border-amber-300/20 bg-black/35 p-4 sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.16),transparent_45%)]" />
      <div className="relative grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative rounded-lg border border-white/10 bg-white/[0.04] p-3.5 sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-300/30 bg-amber-300/10 text-amber-200">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/70 sm:tracking-[0.2em]">
                Step {index + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">{step.label}</h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HumanStackVisual() {
  const layers = [
    "Environment",
    "Behavior",
    "Decision",
    "Attention",
    "Belief",
    "Body",
  ];

  return (
    <div className="rounded-lg border border-sky-300/20 bg-sky-300/[0.04] p-4 sm:p-7">
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        {layers.map((layer, index) => (
          <div
            key={layer}
            className="rounded-md border border-white/10 bg-black/35 px-3.5 py-3 sm:px-4"
            style={{ marginInline: `${Math.min(index * 8, 28)}px` }}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-white">{layer}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-sky-200/60 sm:tracking-[0.18em]">
                Layer {layers.length - index}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LibraryVisual() {
  const paths = ["Experience", "Pattern", "Memory", "Wisdom", "Execution"];
  return (
    <div className="rounded-lg border border-violet-300/20 bg-violet-300/[0.04] p-4 sm:p-7">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {paths.map((path, index) => (
          <div key={path} className="rounded-lg border border-white/10 bg-black/35 p-3.5 sm:p-4">
            <div className="mb-6 flex items-center justify-between sm:mb-8">
              <BookOpen className="h-5 w-5 text-violet-200" />
              <span className="font-mono text-xs text-violet-200/50">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{path}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/[0.08] py-11 sm:py-20">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70 sm:text-[11px] sm:tracking-[0.28em]">
        {eyebrow}
      </p>
      <h2 className="max-w-3xl font-serif text-[clamp(2rem,10vw,3rem)] leading-tight text-white sm:text-5xl">
        {title}
      </h2>
      <div className="mt-7 space-y-5 text-[15px] leading-8 text-zinc-300 sm:mt-8 sm:text-lg">
        {children}
      </div>
    </section>
  );
}

function ClosingDoctrine() {
  return (
    <section className="border-t border-white/[0.08] py-8 sm:py-12">
      <div className="rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.025] to-amber-300/[0.08] p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-200/30 bg-amber-200/10">
            <Orbit className="h-5 w-5 text-amber-100" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/70 sm:tracking-[0.22em]">
              Closing Doctrine
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-white sm:text-2xl">
              The Program is lived, not consumed.
            </h2>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-[15px] leading-8 text-zinc-300 sm:text-lg">
          Do not confuse reading with transformation. Read, then choose one
          loop. Observe it honestly. Interrupt it once. Repeat the new
          motion until your life starts proving the document true.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/oracle"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-black/25 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30 sm:w-auto"
          >
            <Workflow className="h-4 w-4" />
            Read The Oracle
          </Link>
          <Link
            href="/manifesto"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-black/25 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30 sm:w-auto"
          >
            <Layers3 className="h-4 w-4" />
            Read The Manifesto
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function OmniProgramPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const timer = window.setTimeout(() => router.push("/login"), 250);
      return () => window.clearTimeout(timer);
    }
  }, [loading, router, user]);

  if (loading) return <SkeletonGate />;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050506] px-6 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
          <Shield className="mx-auto h-8 w-8 text-amber-200" />
          <h1 className="mt-4 text-xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-sm text-zinc-400">Redirecting to the private entry.</p>
        </div>
      </main>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050506] text-white noise-overlay">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4 sm:px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-amber-200" />
            <span className="text-base font-bold text-white">Omni AI</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-amber-200/40 hover:text-amber-100"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <article className="mx-auto max-w-5xl px-3 pt-28 pb-10 sm:px-5 sm:py-20">
        <section className="relative overflow-hidden rounded-lg border border-amber-300/20 bg-black/35 p-6 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(251,191,36,0.18),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(56,189,248,0.12),transparent_35%)]" />
          <div className="relative">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/75 sm:text-[11px] sm:tracking-[0.32em]">
              Private Document
            </p>
            <h1 className="max-w-4xl whitespace-nowrap font-serif text-[clamp(1.95rem,9.4vw,4.5rem)] leading-[0.98] tracking-normal text-white sm:text-7xl">
              The Omni Program
            </h1>
            <p className="mt-6 max-w-3xl text-[15px] leading-8 text-zinc-300 sm:mt-7 sm:text-xl">
              A signed-in operating manual for living with more perception,
              cleaner agency, and fewer unconscious loops. Not a dashboard.
              A document you return to until the pattern lives in you.
            </p>
            <div className="mt-8 grid grid-cols-[1.45fr_1fr] gap-3 max-[340px]:grid-cols-1 sm:flex sm:flex-wrap">
              <a
                href="#definitions"
                className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-amber-200/30 bg-amber-200/10 px-3 text-[13px] font-semibold text-amber-100 transition-colors hover:border-amber-100/60 sm:w-auto sm:px-4 sm:text-sm"
              >
                Read the definitions
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#practice"
                className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-zinc-200 transition-colors hover:border-white/30 sm:w-auto sm:px-4 sm:text-sm"
              >
                Open the practice
              </a>
            </div>
          </div>
        </section>

        <Section eyebrow="01 / What Life Is" title="Life is the training ground for attention.">
          <p>
            Most people think their life is made of events. It is not. It is
            made of attention, interpretation, reaction, and repetition. What
            you repeat becomes your operating system. What you refuse to see
            becomes your constraint.
          </p>
          <p>
            The Omni Program starts with a simple idea: a person is not broken.
            A person is running programs. Some were inherited. Some were
            installed by fear. Some were built for survival and never retired.
            The work is not to hate the old program. The work is to see it,
            rewrite it, and live from something cleaner.
          </p>
        </Section>

        <OmniLoopVisual />

        <Section eyebrow="02 / The Operating System" title="Your life changes when your loop changes.">
          <p>
            The loop is observe, discern, act, integrate. Observation without
            action becomes rumination. Action without observation becomes
            chaos. Integration is where the lesson becomes a new default.
          </p>
          <p>
            The Program is not motivation. Motivation rises and disappears.
            The Program is architecture. It makes the right action easier to
            repeat than the old escape.
          </p>
        </Section>

        <HumanStackVisual />

        <Section eyebrow="03 / The Stack" title="Every human carries a stack.">
          <p>
            Body, belief, attention, decision, behavior, environment. Change
            one layer and the others begin to move. Ignore one layer and it
            will quietly govern the rest.
          </p>
          <p>
            This is why information alone rarely changes a life. A person can
            know the truth and still live the old loop. The body must feel
            safety. The attention must stabilize. The environment must stop
            rewarding the pattern you claim to be done with.
          </p>
        </Section>

        <section id="definitions" className="border-t border-white/[0.08] py-11 sm:py-20">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70 sm:text-[11px] sm:tracking-[0.28em]">
            04 / Definitions
          </p>
          <h2 className="max-w-3xl font-serif text-[clamp(2rem,10vw,3rem)] leading-tight text-white sm:text-5xl">
            Words become tools when they are defined cleanly.
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {definitions.map((item) => (
              <div key={item.term} className="rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                <h3 className="text-lg font-semibold text-amber-100">{item.term}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <LibraryVisual />

        <Section eyebrow="05 / The Library" title="Everything you live becomes reference material.">
          <p>
            The Library is not a place. It is the archive of every pattern you
            have survived, every truth you have earned, and every move you
            have watched work in reality. You are not meant to carry it as
            pain. You are meant to convert it into wisdom.
          </p>
          <p>
            The highest use of memory is not nostalgia or regret. It is
            pattern recognition. The Library teaches you what repeats, what
            collapses, what compounds, and what was never yours to carry.
          </p>
        </Section>

        <section id="practice" className="border-t border-white/[0.08] py-11 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70 sm:text-[11px] sm:tracking-[0.28em]">
                06 / Practice
              </p>
              <h2 className="font-serif text-[clamp(2rem,10vw,3rem)] leading-tight text-white sm:text-5xl">
                How to live inside the Omni Program.
              </h2>
              <p className="mt-6 text-[15px] leading-8 text-zinc-300 sm:mt-7 sm:text-lg">
                The practice is not complicated. It is repeated until it
                becomes hard to lie to yourself, hard to waste your attention,
                and hard to abandon the future you said you wanted.
              </p>
            </div>
            <div className="grid gap-3">
              {practices.map((practice, index) => (
                <div key={practice} className="flex gap-3 rounded-lg border border-white/10 bg-black/30 p-3.5 sm:gap-4 sm:p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-amber-200/25 bg-amber-200/10 text-sm font-semibold text-amber-100">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium leading-7 text-zinc-200">{practice}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <DocumentSignature documentSlug="omni-program" />
        <ClosingDoctrine />
      </article>
    </main>
  );
}
