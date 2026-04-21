"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ArrowRight, Clock, Target, Calendar } from "lucide-react";

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
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="relative max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          The Omni AI affiliate consultation, explained.
        </h1>
        <p className="text-lg text-gray-400 mb-10">
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
          {faq.map((f) => (
            <div key={f.q} className="rounded-xl p-6 border border-white/10 bg-white/[0.02]">
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
