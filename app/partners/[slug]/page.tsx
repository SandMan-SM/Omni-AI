import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles, Target, Activity, Mail, Trophy, Rocket, Gift } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Co-branded conversion landing page. Linked from every newsletter's
 * "Powered by Omni AI" footer. Slug → omni_businesses lookup; unknown
 * slugs render a generic "Powered by Omni AI" page so any future newsletter
 * still has somewhere to land.
 */

export const revalidate = 600; // 10-minute ISR — partner data doesn't churn often

type Params = { slug: string };

async function getPartner(slug: string) {
  const sb = createAdminClient();
  const { data: byField } = await sb
    .from("omni_businesses")
    .select("id, name, slug, website, brand_logo_url, partnership_blurb, industry, location")
    .or(`slug.ilike.${slug},name.ilike.${slug}`)
    .limit(1)
    .maybeSingle();
  return byField ?? null;
}

async function getOmniAiBookingUrl(): Promise<string> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("omni_businesses")
    .select("id")
    .ilike("name", "Omni AI")
    .maybeSingle();
  return data?.id ? `/book/${data.id}` : "/book";
}

async function getTrendingPosts() {
  const sb = createAdminClient();
  const { data } = await sb
    .from("landing_pages")
    .select("slug, title, description")
    .order("created_at", { ascending: false })
    .limit(3);
  return data ?? [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getPartner(slug);
  const partnerName = partner?.name ?? "Omni AI Partners";
  const title = `Omni AI × ${partnerName} — Agentic Growth Partnership`;
  const description = partner?.partnership_blurb
    ?? `See how ${partnerName} is using Omni AI's agentic infrastructure to grow autonomously. Live analytics, AI-driven content, instant lead routing.`;
  const canonical = `https://omnileadsagi.com/partners/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "Omni AI" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PartnerPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  if (!slug) notFound();

  const [partner, omniBookingPath, trending] = await Promise.all([
    getPartner(slug),
    getOmniAiBookingUrl(),
    getTrendingPosts(),
  ]);

  const partnerName = partner?.name ?? "our partners";
  const partnerWebsite = partner?.website;
  const blurb =
    partner?.partnership_blurb ??
    `${partnerName} is one of the businesses we run agentic growth infrastructure for — autonomous lead generation, live site analytics, content engines, and a full agentic dashboard built around their goals.`;

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Omni AI",
    url: "https://omnileadsagi.com",
    sameAs: ["https://omnileadsagi.com"],
    description: "Autonomous AI marketing and lead-generation infrastructure for local businesses.",
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[560px] h-[560px] rounded-full bg-gradient-to-tr from-purple-500/15 via-pink-500/10 to-transparent blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto px-6 py-24 sm:py-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono uppercase tracking-widest mb-6">
            <Sparkles className="w-3 h-3" />
            Agentic Partnership
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight mb-5">
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
              Omni AI
            </span>
            <span className="text-gray-500 mx-3">×</span>
            <span className="text-white">{partnerName}</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl leading-relaxed mb-8">{blurb}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={omniBookingPath}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm hover:opacity-95 transition shadow-lg shadow-emerald-500/20"
            >
              Book a 20-min strategy call
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/interlinked"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 hover:border-white/30 text-white font-semibold text-sm transition"
            >
              Explore INTERLINKED
              <ArrowRight className="w-4 h-4" />
            </Link>
            {partnerWebsite && (
              <a
                href={partnerWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 hover:border-white/25 text-gray-300 hover:text-white font-medium text-sm transition"
              >
                Visit {partnerName}
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* What Omni AI does */}
      <section className="border-b border-white/5 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">What we run for {partnerName}</h2>
          <p className="text-gray-400 mb-10">Four interlocking systems, fully autonomous, fully measured.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { Icon: Target,   title: "Autonomous lead gen", body: "AI agents source, qualify, and route leads end-to-end." },
              { Icon: Activity, title: "Live site analytics", body: "Every page view, click, and scroll — streaming in real time." },
              { Icon: Mail,     title: "Newsletter engine",   body: "AI-drafted, AI-tested, audience-segmented newsletters on a schedule." },
              { Icon: Trophy,   title: "Agentic dashboard",   body: "One command center for leads, pipeline, content, and meetings." },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition">
                <Icon className="w-5 h-5 text-emerald-400 mb-3" />
                <h3 className="font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending content */}
      {trending.length > 0 && (
        <section className="border-b border-white/5 py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">What&apos;s trending right now</h2>
            <p className="text-gray-400 mb-10">Daily AI &amp; business intelligence — written by our agents, deployed by our infrastructure.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {trending.map((p) => (
                <Link
                  key={p.slug}
                  href={`/${p.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-purple-500/30 hover:bg-purple-500/[0.03] transition block"
                >
                  <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-purple-300 transition">{p.title}</h3>
                  <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{p.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-purple-400 font-medium">
                    Read <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Free programs */}
      <section className="border-b border-white/5 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] via-orange-500/[0.03] to-transparent p-8 sm:p-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono uppercase tracking-widest mb-4">
              <Gift className="w-3 h-3" />
              Free programs
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Get sponsored. Get scaled.</h2>
            <p className="text-gray-300 max-w-2xl mb-6 leading-relaxed">
              We sponsor a small number of businesses with the Omni AI agentic stack at zero cost — full
              dashboard access, AI agents, and content engine. Apply if you&apos;re ready to be one of the
              flagship case studies for the next wave.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/join"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm hover:opacity-95 transition"
              >
                Apply to be sponsored
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sponsor"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-amber-500/30 hover:border-amber-500/50 text-amber-200 font-semibold text-sm transition"
              >
                Sponsor program details
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Rocket className="w-10 h-10 text-emerald-400 mx-auto mb-5" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Want what {partnerName} has?
          </h2>
          <p className="text-lg text-gray-300 mb-8 leading-relaxed">
            Book a 20-minute strategy call. We&apos;ll walk you through the agentic infrastructure
            powering this partnership and show you what it would look like for your business.
          </p>
          <Link
            href={omniBookingPath}
            className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-base hover:opacity-95 transition shadow-2xl shadow-emerald-500/20"
          >
            Book a strategy call
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
