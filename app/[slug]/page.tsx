import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import LeadForm from "./LeadForm";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getLandingPage(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("slug, topic, title, description, date, tweet_url")
    .eq("slug", slug)
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page) return { title: "Not Found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  const title = page.title || page.topic;
  const description =
    page.description ||
    `${page.topic} — See how Omni AI helps businesses automate marketing and win with AI.`;
  const ogImage = `${siteUrl}/api/og?slug=${slug}&title=${encodeURIComponent(title)}&topic=${encodeURIComponent(page.topic)}`;

  return {
    title: `${title} | Omni AI`,
    description,
    keywords: `AI marketing, AI automation, ${page.topic}, Omni AI, business AI, lead generation`,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl}/${slug}`,
      siteName: "Omni AI",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: "@SitaniMafi",
    },
    alternates: {
      canonical: `${siteUrl}/${slug}`,
    },
  };
}

export default async function TrendingLandingPage({ params }: Props) {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page) notFound();

  const title = page.title || page.topic;
  const description =
    page.description ||
    `${page.topic} — See how Omni AI helps businesses automate marketing and win with AI.`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${siteUrl}/${slug}`,
    publisher: {
      "@type": "Organization",
      name: "Omni AI",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
    },
    datePublished: page.date,
    inLanguage: "en-US",
    about: {
      "@type": "Thing",
      name: page.topic,
    },
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Animated gradient background — single purple glow top-left only, no pink blob */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute rounded-full opacity-20 blur-3xl"
          style={{
            width: 700,
            height: 700,
            background: "radial-gradient(circle, #6366f1, transparent 70%)",
            top: -200,
            left: -200,
            animation: "drift1 14s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* Top shimmer bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{
          background: "linear-gradient(90deg, #6366f1, #ec4899, #06b6d4, #6366f1)",
          backgroundSize: "200% 100%",
          animation: "shimmer 3s linear infinite",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
          >
            Omni AI
          </Link>
          <Link
            href="/interlinked"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Book a Call →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[90vh] text-center px-5 py-20">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest text-purple-300 border border-purple-500/30"
          style={{ background: "rgba(99,102,241,0.1)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-purple-400"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          />
          Trending Now · Omni AI
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.02] tracking-tight mb-6 max-w-5xl">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #c4b5fd 0%, #f0abfc 40%, #67e8f9 100%)",
            }}
          >
            {title}
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-10">
          {description}
        </p>

        {/* Lead form */}
        <div className="w-full max-w-md mx-auto">
          <LeadForm slug={slug} />
        </div>

        {/* Stats */}
        <div className="flex flex-nowrap justify-center items-center mt-36 w-full max-w-2xl mx-auto">
          {[
            { num: "10x", label: "Faster Content" },
            { num: "80%", label: "Cost Reduction" },
            { num: "24/7", label: "AI on Autopilot" },
          ].map(({ num, label }, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="text-center w-full py-2">
                <div
                  className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent mb-2"
                  style={{ backgroundImage: "linear-gradient(135deg, #818cf8, #22d3ee)" }}
                >
                  {num}
                </div>
                <div className="text-xs sm:text-sm text-white font-semibold uppercase tracking-widest">
                  {label}
                </div>
              </div>
              {i < 2 && (
                <div className="w-px h-14 bg-white/15 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Topic pill */}
        <p className="mt-16 text-xs text-gray-600 uppercase tracking-widest">
          Today&apos;s trend: {page.topic}
        </p>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center">
        <p className="text-sm text-gray-600">
          Powered by{" "}
          <Link href="https://omnileadsagi.com" className="text-gray-400 hover:text-white transition-colors">
            Omni AI
          </Link>{" "}
          — omnileadsagi.com
        </p>
      </footer>

      <style>{`
        @keyframes drift1 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(80px, 60px) scale(1.2); }
        }
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}
