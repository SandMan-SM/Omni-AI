"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Star, Network, Zap, MessagesSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Breadcrumb } from "@/components/breadcrumb";

const benefits = [
  {
    icon: Star,
    title: "Option to get featured",
    description:
      "Premium members can be featured across Interlinked editions and the Omni AI Arena — visibility to thousands of operators and buyers.",
  },
  {
    icon: Network,
    title: "Direct access to the internal network",
    description:
      "Private channel with the Omni AI operators, partners, and the businesses we actively work with. Warm intros, deal flow, and answers in hours, not weeks.",
  },
  {
    icon: Zap,
    title: "Priority on everything",
    description:
      "Front-of-line on new agents, consultations, tooling drops, and feature requests. Your tickets skip the queue.",
  },
  {
    icon: MessagesSquare,
    title: "1-on-1 exclusive consultations",
    description:
      "Direct strategy sessions with the Omni AI team. Bring a bottleneck — leave with the system that removes it.",
  },
];

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 py-20">
          {/* Visible breadcrumb — paired with the breadcrumbSchema in
              app/interlinked/premium/layout.tsx. Centered above the hero
              to match the centered hero composition without distorting
              the vertical rhythm. Google only awards the SERP breadcrumb
              chip when the schema and visible UI agree. */}
          <div className="flex justify-center mb-8">
            <Breadcrumb
              items={[
                { name: "Home", href: "/" },
                { name: "Interlinked", href: "/interlinked" },
                { name: "Premium", href: "/interlinked/premium" },
              ]}
              className="text-xs"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-200 font-medium">Interlinked Premium</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              The inside track on AI,<br />business, and leverage.
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Interlinked Premium is the private edition of our daily intelligence brief — paired with direct access,
              priority, and the people actually building with AI.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  viewport={{ once: true }}
                  className="relative rounded-2xl p-6 border border-white/10 bg-white/[0.02] hover:border-amber-400/30 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 14px rgba(250, 204, 21, 0.3)",
                    }}
                  >
                    <Icon className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{b.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{b.description}</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative rounded-3xl p-10 md:p-14 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-white/[0.02] to-transparent text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 mb-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider">Membership</span>
            </div>
            <div className="flex items-end justify-center gap-2 mb-2">
              <span className="text-5xl md:text-6xl font-bold">$100</span>
              <span className="text-gray-400 mb-2">/ month</span>
            </div>
            <p className="text-gray-400 mb-8">Cancel anytime. All four benefits included from day one.</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/api/newsletter/payment-link?tier=premium" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 text-black font-bold px-10 py-6 text-base rounded-xl">
                  Become a Premium Member
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/auth" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/5 px-8 py-6 text-base rounded-xl">
                  Sign in
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
