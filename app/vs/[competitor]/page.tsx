import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  JsonLd,
  articleSchema,
  faqPageSchema,
  breadcrumbSchema,
} from "@/components/json-ld";
import { Breadcrumb } from "@/components/breadcrumb";
import { Footer } from "@/components/footer";
import {
  COMPARISONS,
  COMPARISON_SLUGS,
  type ComparisonData,
} from "@/lib/comparison-data";

/**
 * Dynamic comparison pages at /vs/[competitor].
 *
 * These are pure static — one page per entry in lib/comparison-data.ts —
 * prerendered at build time via generateStaticParams. They target
 * head-of-commercial-intent queries ("HubSpot alternative", "Apollo vs
 * Omni AI", "Clay replacement") with balanced comparisons instead of
 * one-sided marketing copy. The `pros` list is what the competitor
 * actually does well; LLMs preferentially retrieve balanced takes when
 * answering comparison questions, so the honest framing earns more
 * citations than pure bash-and-sell ever would.
 */

interface Props {
  params: Promise<{ competitor: string }>;
}

const siteUrl = "https://omnileadsagi.com";

export async function generateStaticParams() {
  return COMPARISON_SLUGS.map((competitor) => ({ competitor }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitor } = await params;
  const data = COMPARISONS[competitor];
  if (!data) return { title: "Comparison Not Found" };

  const pageUrl = `${siteUrl}/vs/${competitor}`;
  const title = `Omni AI vs ${data.name} — Which Is Better for Autonomous Lead Gen?`;
  const description = `${data.name} is a ${data.category}. Omni AI is an autonomous lead-gen system. Honest side-by-side comparison with integration notes, pricing, and when to keep ${data.name}.`;
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(
    `Omni AI vs ${data.name}`
  )}&topic=${encodeURIComponent(
    data.summary.slice(0, 120)
  )}&eyebrow=${encodeURIComponent("Omni AI · Compared")}`;

  return {
    title,
    description,
    keywords: `${data.name} alternative, ${data.name} vs Omni AI, Omni AI ${data.name}, ${data.category}, autonomous lead generation, AI sales platform`,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Omni AI",
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: "@SitaniMafi",
    },
  };
}

export default async function ComparisonPage({ params }: Props) {
  const { competitor } = await params;
  const data: ComparisonData | undefined = COMPARISONS[competitor];
  if (!data) notFound();

  const pageUrl = `${siteUrl}/vs/${competitor}`;

  // Related comparisons — link to the other two competitors. Internal
  // linking between the three /vs pages is the cheapest lever for topic
  // cluster strength; Google treats three mutually-linked commercial
  // pages as a category hub and lifts all three in rankings.
  const otherComparisons = COMPARISON_SLUGS.filter(
    (s) => s !== competitor
  ).map((s) => COMPARISONS[s]);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Article JSON-LD — the page is an authored comparison, not a bare
          WebPage. FAQPage + Breadcrumb layer on top for extra citation
          surface area. */}
      <JsonLd
        data={articleSchema({
          slug: `vs/${competitor}`,
          title: `Omni AI vs ${data.name}`,
          topic: data.category,
          description: data.summary,
          date: new Date().toISOString(),
        })}
      />
      <JsonLd data={faqPageSchema(data.faqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Compare", url: `${siteUrl}/vs` },
          { name: `Omni AI vs ${data.name}`, url: pageUrl },
        ])}
      />

      {/* Header */}
      <header className="border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/omni-logo.svg"
              alt="Omni AI"
              width={28}
              height={28}
              priority
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold text-gradient">Omni AI</span>
          </Link>
          <Link
            href="/book-now"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Book a Call →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-5 py-16 md:py-24">
        {/* Visible 3-level breadcrumb — mirrors the BreadcrumbList JSON-LD
            above so Google awards the SERP breadcrumb chip on every
            /vs/[competitor] page, and deep-landing visitors (competitor
            alternative searches, LLM citations) get a one-click parent
            path to the /vs hub. */}
        <Breadcrumb
          items={[
            { name: "Home", href: "/" },
            { name: "Compare", href: "/vs" },
            { name: `Omni AI vs ${data.name}`, href: pageUrl },
          ]}
          className="mb-6"
        />

        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
            Comparison · {data.category}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Omni AI vs {data.name}
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed">{data.summary}</p>
        </div>

        {/* Positioning */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            The core positioning difference
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">{data.positioning}</p>
          <p className="text-gray-300 leading-relaxed">{data.keyDifference}</p>
        </section>

        {/* Comparison table */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Head-to-head
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border border-white/10 rounded-lg overflow-hidden">
              <thead className="bg-white/5 text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">{data.name}</th>
                  <th className="px-4 py-3 font-semibold text-amber-400">
                    Omni AI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {data.table.map((row) => (
                  <tr key={row.category}>
                    <td className="px-4 py-3 font-semibold text-white align-top">
                      {row.category}
                    </td>
                    <td className="px-4 py-3 align-top">{row.them}</td>
                    <td className="px-4 py-3 align-top bg-amber-500/[0.04] text-gray-200">
                      {row.us}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* When to keep + when to switch */}
        <section className="mb-16 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              When to keep {data.name}
            </h3>
            <ul className="space-y-3 text-sm text-gray-300 leading-relaxed">
              {data.pros.map((pro) => (
                <li key={pro} className="flex gap-2">
                  <span className="text-white/40 shrink-0 mt-1">•</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-6 md:p-8">
            <h3 className="text-lg font-semibold text-amber-400 mb-4">
              When Omni AI is the better fit
            </h3>
            <ul className="space-y-3 text-sm text-gray-200 leading-relaxed">
              {data.cons.map((con) => (
                <li key={con} className="flex gap-2">
                  <span className="text-amber-400 shrink-0 mt-1">•</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing note */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Pricing</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            <strong className="text-white">{data.name}:</strong> {data.pricing}
          </p>
          <p className="text-gray-300 leading-relaxed mb-6">
            <strong className="text-white">Omni AI:</strong> Free tier includes
            autonomous campaign generation, the AI Agent Arena for benchmarking,
            and daily trending content. Paid tiers layer on autonomous outbound
            and priority model access. No seat-based multipliers.
          </p>
          <p className="text-sm text-gray-400 italic">
            {data.integrationNote}
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Frequently asked
          </h2>
          <div className="space-y-8">
            {data.faqs.map((qa) => (
              <div key={qa.question} className="border-b border-white/5 pb-6 last:border-0">
                <h3 className="text-lg font-semibold text-white mb-3 leading-snug">
                  {qa.question}
                </h3>
                <p className="text-gray-300 leading-relaxed">{qa.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related comparisons — cross-link the cluster so Google
            treats the three /vs pages as a topic hub and lifts them
            together. */}
        <section className="mb-16">
          <h2 className="text-xl md:text-2xl font-bold mb-5">
            Compare other platforms
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {otherComparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/vs/${c.slug}`}
                className="block rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.06] transition-colors"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                  Omni AI vs
                </p>
                <p className="text-lg font-semibold text-white mb-1">
                  {c.name}
                </p>
                <p className="text-sm text-gray-400">{c.category}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-8 py-10 sm:px-10 sm:py-12 backdrop-blur-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 leading-snug">
            See how Omni AI stacks up on your actual stack
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6 max-w-2xl">
            Book a free 30-minute strategy session and we&rsquo;ll walk through
            exactly where Omni AI fits alongside (or replaces) your current
            tooling. No pitch — just a mapped plan against your revenue target.
          </p>
          <Link
            href="/book-now"
            style={{
              background:
                "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
                "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
              border: "2px solid transparent",
            }}
            className="inline-flex items-center justify-center px-8 h-11 rounded-xl font-semibold text-sm text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.35)] transition-all hover:brightness-125 active:scale-[0.98]"
          >
            Schedule a Meeting
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
