"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ArrowLeft, Star, MessageCircle, Lightbulb, Map } from "lucide-react";
import { BookDemoModal } from "@/components/modals/lazy";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FireSparksBackdrop } from "@/components/fire-sparks-backdrop";

export default function BookNowPage() {
  const [open, setOpen] = useState(true);

  return (
    // No opaque bg — FireSparksBackdrop paints through. Same warm
    // backdrop used on /arena and /newsletter/[slug] so the chrome-gold
    // button sits on a matching amber/orange ember field.
    <div className="min-h-screen text-white relative">
      <FireSparksBackdrop />
      <Navbar />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-24">
        {/* Hero — reframed around the conversation, not the sale. "Free"
            leads, "no pitch" reassures, and the subhead literally spells
            out that we just talk and figure out what you need. */}
        <div className="text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6 backdrop-blur-sm">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-200 font-medium">100% Free · No pitch · 30 minutes</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5">Book Now</h1>
          <p className="text-gray-300 text-lg md:text-xl mb-3 max-w-2xl leading-relaxed">
            It&apos;s free. Genuinely free. No credit card, no contract, no
            &ldquo;and then here&apos;s the upsell.&rdquo;
          </p>
          <p className="text-gray-400 text-base md:text-lg mb-8 max-w-2xl leading-relaxed">
            We just talk. You tell us what your business looks like today,
            where it&apos;s getting stuck, and what you&apos;re trying to
            build next. Then we figure out together what would actually work
            best for you — whether that&apos;s something we help with, or
            something you can run on your own.
          </p>
          <div className="flex items-center gap-6 mb-16">
            {/* Chrome-gold treatment — same padding-box/border-box gradient
                trick used on /newsletter/[slug] so the radius stays intact.
                Matches the Back home button in height/radius/text-size so the
                pair reads as a uniform row. */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                background:
                  "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
                border: "2px solid transparent",
              }}
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-semibold text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
            >
              Open Scheduler
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm text-gray-300 hover:text-white border border-white/25 hover:border-white/40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back home
            </Link>
          </div>
        </div>

        {/* What happens on the call — three-step triptych. Keeps the
            "no-pitch conversation" promise concrete so the reader isn't
            just taking our word for it. */}
        <div className="mb-20">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-amber-400 mb-8">
            What happens on the call
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: MessageCircle,
                title: "1. You talk. We listen.",
                body: "Tell us about your business, your team, where you&rsquo;re bleeding time or money. No forms to fill out. No qualifying questionnaire.",
              },
              {
                icon: Lightbulb,
                title: "2. We give straight advice.",
                body: "Based on what you actually said — not a pre-baked deck. If AI isn&rsquo;t the right fix for your problem, we&rsquo;ll tell you that too.",
              },
              {
                icon: Map,
                title: "3. You leave with a plan.",
                body: "Three concrete moves you can make in the next 30 days. Work with us, work with someone else, or run it yourself. No pressure either way.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-amber-500/15 bg-white/[0.03] backdrop-blur-sm p-6 flex flex-col"
              >
                {/* Copy grows to fill the card so the icon sits pinned at
                    the bottom across all three regardless of body length. */}
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-2 text-base">{step.title}</h3>
                  <p
                    className="text-gray-400 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: step.body }}
                  />
                </div>
                <div className="flex justify-center mt-6">
                  <step.icon className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews — social proof. Placeholder testimonials modeled on the
            kinds of operators we actually work with (local services, med
            spas, trades, contractors). Swap in real customer quotes as
            they come in. */}
        <div>
          <p className="text-center text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
            What people say
          </p>
          <h2 className="text-center text-2xl md:text-3xl font-bold text-white mb-10">
            Zero pitch. Real help.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                quote:
                  "Showed up expecting a sales pitch, left with a full playbook for my lead pipeline. 30 free minutes turned into something I could actually run Monday morning.",
                name: "Jesse R.",
                role: "HVAC contractor",
              },
              {
                quote:
                  "I&rsquo;ve talked to four AI agencies. This was the only one where they listened before proposing anything. Ended up with a simpler, cheaper fix than what the others pushed.",
                name: "Mia T.",
                role: "Med-spa owner",
              },
              {
                quote:
                  "Zero pressure. They asked about my business, where the bottleneck was, and gave me three concrete moves — two of which I did myself. Wasn&rsquo;t a pitch, was genuine help.",
                name: "Daniel K.",
                role: "Roofing business owner",
              },
            ].map((r) => (
              <figure
                key={r.name}
                className="rounded-2xl border border-amber-500/20 bg-white/[0.04] backdrop-blur-sm p-6 flex flex-col"
              >
                {/* Top row — name flush left, 5 stars flush right. */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white font-semibold text-sm">{r.name}</span>
                  {/* lucide-react Star defaults to fill="none" on the
                      SVG itself, which can beat Tailwind's fill-* utility
                      depending on how Tailwind's JIT picked things up.
                      Passing fill="currentColor" as a prop sets it
                      directly on the SVG so the star is reliably solid,
                      matching the amber text color. */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-amber-400"
                        fill="currentColor"
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </div>

                {/* Quote grows to fill so the role below sits pinned
                    center-bottom across all three cards. */}
                <blockquote
                  className="text-gray-200 text-sm leading-relaxed italic flex-1"
                  dangerouslySetInnerHTML={{ __html: `&ldquo;${r.quote}&rdquo;` }}
                />

                {/* Role — centered, bottom of the card. */}
                <figcaption className="text-center text-xs text-gray-500 mt-5">
                  {r.role}
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Secondary CTA — after proof, nudge again. Same chrome-gold
              button so the eye knows where to land. */}
          <div className="text-center mt-12">
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                background:
                  "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                  "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
                border: "2px solid transparent",
              }}
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-semibold text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
            >
              Grab your free 30 minutes
            </button>
            <p className="text-xs text-gray-500 mt-3">
              30 minutes · free · no obligation
            </p>
          </div>
        </div>
      </div>

      <BookDemoModal
        isOpen={open}
        onClose={() => setOpen(false)}
        heading="Book Now"
        subheading="Free 30-minute consultation — no pitch, just a conversation."
      />

      <Footer />
    </div>
  );
}
