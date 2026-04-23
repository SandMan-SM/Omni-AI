"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Breadcrumb } from "@/components/breadcrumb";
import { ArrowRight, Clock, Target, Calendar } from "lucide-react";

// `faq` is byte-aligned with the FAQPage mainEntity in
// app/affiliate/consultation/info/layout.tsx. If either a Q or an A
// changes, update BOTH in the same commit — the layout's schema is
// what Google and LLMs quote verbatim, the page array is what the
// user reads. A drift between them invalidates the rich result.
const faq = [
  {
    q: "Who is the affiliate consultation for?",
    a: "Creators, consultants, agency owners, and operators who either have an audience or work with small businesses and want to earn recurring revenue by introducing them to Omni AI.",
  },
  {
    q: "What happens on the call?",
    a: "We review your audience or client base, identify the Omni AI products most likely to convert, and leave you with a written plan: which links to use, which hooks to lead with, and the first three placements to run.",
  },
  {
    q: "Is there a cost?",
    a: "No. The consultation is free for anyone who has applied to the affiliate program.",
  },
  {
    q: "How much can an affiliate actually earn?",
    a: "Affiliates earn 30% recurring on every Omni AI subscription they refer, for as long as that customer stays. A handful of active referrals typically clears four figures per month.",
  },
];

export default function AffiliateConsultationInfoPage() {
  // FAQPage JSON-LD and BreadcrumbList JSON-LD both live in
  // app/affiliate/consultation/info/layout.tsx now — consolidated out
  // of an inline dangerouslySetInnerHTML <script> block so this
  // route's schema payload lives in one predictable place (matches
  // the pattern used on every other page with a breadcrumb + FAQ).
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Visible breadcrumb — paired with the breadcrumbSchema in
          app/affiliate/consultation/info/layout.tsx. Google only
          awards the SERP breadcrumb chip when schema + visible UI
          agree. */}
      <div className="flex justify-center pt-10 pb-0 px-4">
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Affiliate Program", href: "/affiliate/info" },
            { name: "Consultation explainer", href: "/affiliate/consultation/info" },
          ]}
          className="text-xs"
        />
      </div>

      <section className="relative max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          The Omni AI affiliate consultation, explained.
        </h1>
        {/* data-speakable="intro" activates the first CSS selector in the
            FAQPage SpeakableSpecification declared in
            app/affiliate/consultation/info/layout.tsx. Voice assistants
            concatenate h1 ("The Omni AI affiliate consultation,
            explained.") + this subtitle as the natural ~9-second reply
            to "what is the Omni AI affiliate consultation?" voice
            queries. The faq-intro marker below handles the specific-
            question voice intents. */}
        <p
          className="text-lg text-gray-400 mb-10"
          data-speakable="intro"
        >
          Thirty minutes on Zoom with an Omni AI strategist. Built for affiliates who want a
          written game plan, not a pitch deck.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Clock, label: "Length", value: "30 minutes" },
            { icon: Target, label: "Outcome", value: "Written playbook" },
            { icon: Calendar, label: "Availability", value: "Mon–Fri" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl p-5 border border-white/10 bg-white/[0.03]">
                <Icon className="w-4 h-4 text-purple-400 mb-2" />
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            );
          })}
        </div>

        <h2 className="text-2xl font-bold mb-6">Frequently asked questions</h2>
        <div className="space-y-4 mb-12">
          {/* data-speakable="faq-intro" on the first Q&A block activates
              the third CSS selector in the FAQPage SpeakableSpecification
              declared in app/affiliate/consultation/info/layout.tsx.
              Voice assistants read the first Q ("Who is the affiliate
              consultation for?") + its A as a single-exchange reply to
              question-intent voice queries like "who is the Omni AI
              affiliate consultation for?" / "how long is the Omni AI
              affiliate consultation?" / "is the Omni AI affiliate
              consultation free?". Only the first item gets the marker —
              reading all four Q&A blocks would overrun the ~10-second
              voice budget. */}
          {faq.map((f, i) => (
            <div
              key={f.q}
              className="rounded-xl p-6 border border-white/10 bg-white/[0.02]"
              data-speakable={i === 0 ? "faq-intro" : undefined}
            >
              <h3 className="font-bold text-lg mb-2">{f.q}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-8 border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent text-center">
          <h3 className="text-2xl font-bold mb-3">Ready to book?</h3>
          <p className="text-gray-400 mb-6">Pick a time that works. We&apos;ll send the Zoom link immediately.</p>
          <Link
            href="/affiliate/book-consultation"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-8 py-4 rounded-xl hover:opacity-90"
          >
            Book my consultation <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
