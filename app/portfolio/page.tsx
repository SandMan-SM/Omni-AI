import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Layers3,
  Newspaper,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { CASE_STUDIES, type CaseStudy } from "@/lib/case-studies";

export const dynamic = "force-static";

const SITE_URL = "https://omnileadsagi.com";
const PAGE_URL = `${SITE_URL}/portfolio`;

export const metadata: Metadata = {
  title: "Portfolio | Omni AI Asset Federation",
  description:
    "Explore the Omni AI asset portfolio: operator websites, AI CEO layers, newsrooms, funnels, dashboards, sponsor systems, and autonomous business infrastructure.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Portfolio | Omni AI Asset Federation",
    description:
      "The public index of Omni AI assets across websites, AI CEOs, newsrooms, funnels, dashboards, and federation infrastructure.",
    url: PAGE_URL,
    type: "website",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio | Omni AI Asset Federation",
    description:
      "Explore the live Omni AI asset federation: websites, AI CEOs, newsrooms, funnels, dashboards, and infrastructure.",
    site: "@SitaniMafi",
    creator: "@SitaniMafi",
  },
};

const STATUS_STYLES: Record<CaseStudy["status"], string> = {
  live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  in_progress: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  scaffold: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  forthcoming: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  archived: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

const STATUS_LABELS: Record<CaseStudy["status"], string> = {
  live: "Live",
  in_progress: "In progress",
  scaffold: "Scaffold",
  forthcoming: "Forthcoming",
  archived: "Archived",
};

const TIER_LABELS: Record<CaseStudy["marketTier"], string> = {
  federation: "Federation HQ",
  bespoke: "Bespoke builds",
  themed: "Themed assets",
  template: "Funnel assets",
};

const personalBrandSlugs = new Set([
  "sitani-mafi",
  "imperium",
  "rene-laveau",
  "live-better-on-the-drip",
  "prime-iv-sandy",
  "alira",
]);

const funnelAssetSlugs = new Set([
  "agiarena",
  "utah-deck",
  "omnileads-shop",
  "ai-digital-marketing",
  "seo-ppc-marketing",
]);

const assetGroups: Array<{
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof Globe2;
  items: CaseStudy[];
}> = [
  {
    key: "hq",
    title: "Federation HQ",
    eyebrow: "Control plane",
    description:
      "The core Omni AI platform: inbound APIs, Pantheon logic, dashboards, embeds, and the operating substrate that lets every other asset compound.",
    icon: BrainCircuit,
    items: CASE_STUDIES.filter((asset) => asset.realm === 2),
  },
  {
    key: "personal-brands",
    title: "Personal Brands",
    eyebrow: "Founder and audience engines",
    description:
      "Founder, artist, mastermind, podcast, and spiritual-leadership surfaces built as owned media assets with autonomous routing underneath.",
    icon: Sparkles,
    items: CASE_STUDIES.filter((asset) => personalBrandSlugs.has(asset.slug)),
  },
  {
    key: "operators",
    title: "Operator Sites",
    eyebrow: "Local business infrastructure",
    description:
      "Conversion-focused business sites with intake, attribution, AI CEO routing, SEO structure, and sponsor/federation distribution.",
    icon: Building2,
    items: CASE_STUDIES.filter(
      (asset) =>
        asset.realm === 1 &&
        asset.role.includes("Operator") &&
        !personalBrandSlugs.has(asset.slug),
    ),
  },
  {
    key: "newsrooms",
    title: "Newsrooms",
    eyebrow: "Publication assets",
    description:
      "Owned local-media mastheads that create recurring attention and give the federation a publishing layer beyond one-off campaigns.",
    icon: Newspaper,
    items: CASE_STUDIES.filter((asset) => asset.role === "Newsroom"),
  },
  {
    key: "funnels",
    title: "Funnels and Utilities",
    eyebrow: "Distribution systems",
    description:
      "Satellites, redirect assets, merch, public proof surfaces, and spectator pages that route traffic into the right node.",
    icon: Rocket,
    items: CASE_STUDIES.filter((asset) => funnelAssetSlugs.has(asset.slug)),
  },
  {
    key: "queued",
    title: "Queued and Emerging",
    eyebrow: "Reserved nodes",
    description:
      "Assets with tenancy, AI CEO groundwork, or positioning in motion before their full public surface is complete.",
    icon: Bot,
    items: CASE_STUDIES.filter(
      (asset) =>
        (asset.status === "in_progress" || asset.status === "forthcoming") &&
        !personalBrandSlugs.has(asset.slug),
    ),
  },
];

const liveAssets = CASE_STUDIES.filter((asset) => asset.status === "live");
const externalAssetCount = CASE_STUDIES.filter((asset) => asset.url !== "#").length;
const aiEnabledCount = CASE_STUDIES.filter(
  (asset) => asset.inboundSlug || asset.combinedSlugs?.length || asset.pantheonCEO,
).length;
const primaryGroups = assetGroups.filter((group) => group.items.length > 0);

const portfolioJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Omni AI Portfolio",
  description:
    "Public portfolio of Omni AI websites, AI CEO layers, newsrooms, funnels, dashboards, and federation infrastructure.",
  url: PAGE_URL,
  isPartOf: {
    "@type": "WebSite",
    name: "Omni AI",
    url: SITE_URL,
  },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: CASE_STUDIES.length,
    itemListElement: CASE_STUDIES.map((asset, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: asset.brand,
      url: asset.url !== "#" ? asset.url : `${SITE_URL}/federation/case-studies/${asset.slug}`,
      description: asset.tagline,
    })),
  },
};

function statusClass(status: CaseStudy["status"]) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.live;
}

function ExternalAssetLink({ asset }: { asset: CaseStudy }) {
  if (asset.url === "#") {
    return (
      <span className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-500">
        Domain reserved
      </span>
    );
  }

  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-zinc-100 transition hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-100"
      aria-label={`Open ${asset.brand} live asset`}
    >
      Live asset
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function AssetCard({ asset }: { asset: CaseStudy }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-white/10 bg-zinc-950/60 p-5 shadow-2xl shadow-black/20 transition hover:border-amber-300/40 hover:bg-zinc-950/80">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-white">{asset.brand}</p>
          <p className="mt-1 break-words text-xs uppercase tracking-[0.18em] text-zinc-500">
            {asset.domain}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${statusClass(
            asset.status,
          )}`}
        >
          {STATUS_LABELS[asset.status]}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-300">{asset.tagline}</p>

      <div className="mt-5 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Asset type</p>
          <p className="mt-1 text-zinc-200">{asset.role}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Build class</p>
          <p className="mt-1 text-zinc-200">{TIER_LABELS[asset.marketTier]}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {asset.inboundSlug && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Analytics wired
          </span>
        )}
        {asset.pantheonCEO && (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-medium text-violet-100">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            AI CEO
          </span>
        )}
        {asset.combinedSlugs?.length ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
            Cross-portfolio
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
        <ExternalAssetLink asset={asset} />
        <Link
          href={`/federation/case-studies/${asset.slug}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-semibold text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300/20"
        >
          Case study
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export default function PortfolioPage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <JsonLd data={portfolioJsonLd} />
      <section className="relative border-b border-white/10 px-4 pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-amber-300/40 hover:text-white"
          >
            <ArrowUpRight className="h-4 w-4 rotate-180" aria-hidden="true" />
            Back to Omni AI
          </Link>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300">
                Public asset portfolio
              </p>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
                Every Omni AI asset, mapped in one place.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                Websites, AI CEO layers, newsrooms, funnels, sponsor systems, dashboards, and
                distribution utilities built to operate as one compounding federation.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-zinc-500">
                Federation snapshot
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { value: CASE_STUDIES.length, label: "Assets tracked" },
                  { value: liveAssets.length, label: "Live surfaces" },
                  { value: aiEnabledCount, label: "AI enabled" },
                  { value: externalAssetCount, label: "Public URLs" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-3xl font-semibold text-white">{stat.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-3">
          {primaryGroups.map((group) => (
            <a
              key={group.key}
              href={`#${group.key}`}
              className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:border-amber-300/40 hover:text-white"
            >
              {group.title}
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
                {group.items.length}
              </span>
            </a>
          ))}
        </div>
      </section>

      {primaryGroups.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.key} id={group.key} className="px-4 py-12 md:py-16">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] md:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-amber-100">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {group.eyebrow}
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                    {group.title}
                  </h2>
                </div>
                <p className="text-sm leading-7 text-zinc-400 md:text-base">{group.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((asset) => (
                  <AssetCard key={asset.slug} asset={asset} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl rounded-lg border border-white/10 bg-white/[0.04] p-6 md:p-10">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">
                Want the operating layer?
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                The portfolio is the proof. The command center is where it compounds.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 md:text-base">
                Each public asset can feed analytics, leads, bookings, sponsor attribution, and AI
                CEO actions back into the Omni AI control plane.
              </p>
            </div>
            <Link
              href="/command"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Open Command Center
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
