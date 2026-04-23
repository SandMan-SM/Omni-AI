"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, UserPlus, Calendar, DollarSign, Users, TrendingUp, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Breadcrumb } from "@/components/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { AffiliateSignupModal, AffiliateConsultationModal } from "@/components/modals/lazy";

const steps = [
  {
    icon: UserPlus,
    title: "1. Apply in under 60 seconds",
    body: "Sign up with your name, email, and the audience you reach. No fees, no minimums, no gatekeeping.",
  },
  {
    icon: Link2,
    title: "2. Share your unique link",
    body: "Get a tracked affiliate URL the moment you&apos;re approved. Drop it in newsletters, DMs, podcasts, or client conversations.",
  },
  {
    icon: DollarSign,
    title: "3. Earn 30% recurring",
    body: "Every person who signs up through your link earns you 30% of their subscription — every month they stay.",
  },
  {
    icon: TrendingUp,
    title: "4. Scale with tooling",
    body: "A live dashboard shows clicks, conversions, revenue, and the exact pages your audience is responding to.",
  },
];

export default function AffiliateInfoPage() {
  const { user } = useAuth();
  const [signupOpen, setSignupOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const signedIn = !!user;

  const heroCta = signedIn ? (
    <Link href="/dashboard" className="inline-flex">
      <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-bold px-8 py-6 text-base rounded-xl">
        <LayoutDashboard className="w-4 h-4 mr-2" />
        Open Affiliate Dashboard
      </Button>
    </Link>
  ) : (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
      <Button
        onClick={() => setSignupOpen(true)}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-bold px-8 py-6 text-base rounded-xl"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        Sign up
      </Button>
      <Button
        onClick={() => setConsultOpen(true)}
        variant="outline"
        className="border-white/20 text-white hover:bg-white/5 px-8 py-6 text-base rounded-xl"
      >
        <Calendar className="w-4 h-4 mr-2" />
        Book consultation
      </Button>
      <Link href="/affiliate/consultation/info" className="text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
        Learn more
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 text-center">
          {/* Visible breadcrumb — paired with the breadcrumbSchema in
              app/affiliate/info/layout.tsx. Centered via a flex wrapper
              so it sits above the hero without disturbing the centered
              hero composition. Google only awards the SERP breadcrumb
              chip when the schema and visible UI agree, so shipping both
              in the same change keeps the rich-result eligibility clean. */}
          <div className="flex justify-center mb-8">
            <Breadcrumb
              items={[
                { name: "Home", href: "/" },
                { name: "Affiliate Program", href: "/affiliate/info" },
              ]}
              className="text-xs"
            />
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-200 font-medium">Omni AI Affiliate Program</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Get paid to put AI in the hands<br />of businesses that need it.
            </h1>
            {/* data-speakable="intro" activates the
                SpeakableSpecification declared on
                affiliateInfoWebPageSchema in app/affiliate/info/layout.tsx.
                Voice assistants concatenate h1 ("Get paid to put AI in
                the hands of businesses that need it.") + this subtitle
                as the natural ~12-second reply to "how do I become an
                Omni AI affiliate?" / "does Omni AI have an affiliate
                program?" voice queries. */}
            <p
              className="text-lg text-gray-400 max-w-2xl mx-auto mb-10"
              data-speakable="intro"
            >
              Earn 30% recurring on every Omni AI client you refer. Track it live. Get paid monthly.
              Built for creators, consultants, and operators who already talk about this stuff.
            </p>
            {heroCta}
          </motion.div>
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How the affiliate system works</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            One link, recurring revenue, real transparency. Here&apos;s the full loop from signup to payout.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6 border border-white/10 bg-white/[0.02] hover:border-purple-400/30 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: s.body }} />
              </motion.div>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-12">
          {[
            { label: "Commission", value: "30%", sub: "recurring, monthly" },
            { label: "Cookie window", value: "90d", sub: "first-touch attribution" },
            { label: "Payouts", value: "Net-30", sub: "direct deposit or PayPal" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl p-5 border border-white/10 bg-white/[0.03] text-center">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">{stat.label}</p>
              <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative max-w-4xl mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl p-10 md:p-14 border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-white/[0.02] to-transparent text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 mb-4">
            <Users className="w-3.5 h-3.5 text-purple-300" />
            <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider">Ready to start</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Turn your network into recurring revenue.</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Whether you have an audience, a client list, or just a phone — we&apos;ll help you earn.
          </p>
          {signedIn ? (
            <Link href="/dashboard" className="inline-flex">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-bold px-10 py-6 text-base rounded-xl">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => setSignupOpen(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-bold px-8 py-6 text-base rounded-xl"
              >
                Sign up
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                onClick={() => setConsultOpen(true)}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 px-8 py-6 text-base rounded-xl"
              >
                Book consultation
              </Button>
            </div>
          )}
        </motion.div>
      </section>

      <AffiliateSignupModal isOpen={signupOpen} onClose={() => setSignupOpen(false)} />
      <AffiliateConsultationModal isOpen={consultOpen} onClose={() => setConsultOpen(false)} />

      <Footer />
    </div>
  );
}
