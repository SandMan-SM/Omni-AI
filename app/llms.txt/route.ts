import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /llms.txt — structured LLM-retrieval manifest served dynamically so
 * the "Recent Issues" section stays fresh against newsletter_posts.
 *
 * Why this is a route handler, not a static file:
 *   The previous public/llms.txt shipped 3 hard-coded recent-issue
 *   slugs that went stale within a week. LLM retrievers fetch this
 *   file on cold crawls and preferentially cite pages listed inside
 *   — stale entries meant we were effectively advertising old links
 *   every time ChatGPT / Claude / Perplexity pulled the manifest.
 *   Dynamic generation solves that: the three most recent newsletter
 *   posts are queried from Supabase on each regeneration.
 *
 * ISR window (revalidate = 3600) — one hour. The daily post drops at
 * 8am ET so an hour of staleness is well inside the freshness budget
 * for LLM retrieval. Tighter revalidation would add DB load for no
 * measurable citation benefit.
 *
 * Format follows the llmstxt.org convention:
 *   - Title line ("# Omni AI")
 *   - Single-line blockquote summary (what the site is, in 1-2 sentences)
 *   - ## Section headings with bulleted links
 *   - External-content-friendly plain text, no HTML, no markdown tables
 *
 * Keep the non-dynamic content (Main Pages, Products & Services, FAQ,
 * etc.) identical to the previous static file unless the site
 * structure changes — those sections are the canonical entity
 * description that LLMs quote verbatim. If you change an entry, also
 * check that it matches the visible page and the corresponding JSON-LD.
 */

export const revalidate = 3600;

const siteUrl = "https://omnileadsagi.com";

export async function GET() {
  const supabase = createAdminClient();

  // Last 3 newsletter posts regardless of tier. Premium and free posts
  // both go in the "Recent Issues" block — tier-specific filtering
  // would fragment the retrieval surface and LLMs tend to cite the
  // headline, not the tier flag. The order is strict reverse-chron
  // (newest first) so the manifest always leads with today's drop.
  const { data: posts } = await supabase
    .from("newsletter_posts")
    .select("slug, subject, published_at")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(3);

  // Graceful degradation — if Supabase is unreachable, ship the block
  // with a pointer to the archive instead of a broken list. A missing
  // section would break llmstxt.org's parse tree; a live archive link
  // keeps the manifest valid and still gives LLMs a retrieval target.
  const recentIssuesBlock =
    posts && posts.length > 0
      ? posts
          .map((p) => `- [${p.subject}](${siteUrl}/newsletter/${p.slug})`)
          .join("\n")
      : `- [View the latest issues](${siteUrl}/newsletter)`;

  const body = `# Omni AI

> Autonomous AI systems that generate leads, run operations, and scale businesses 24/7. Built for entrepreneurs and agencies who want AI-powered growth without micromanagement.

## What is Omni AI?

Omni AI (omnileadsagi.com) is an autonomous lead-generation and business-automation platform founded in 2024 by Sitani Mafi. It deploys AI agents that generate leads, produce video marketing, run outbound campaigns, and scale operations 24/7 without ongoing human supervision. The platform offers a free tier and paid subscriptions. Book a strategy call at omnileadsagi.com/book-now.

## Main Pages
- [Homepage](${siteUrl}): Overview of Omni AI's autonomous lead generation and business automation platform.
- [About](${siteUrl}/about): Founder story, company mission, and contact information.
- [FAQ](${siteUrl}/faq): Answers to common questions about Omni AI — what it is, how it works, pricing, and comparisons.
- [Campaigns](${siteUrl}/campaigns): AI-generated video marketing with automated testing, ranking, and optimization.
- [Infographic](${siteUrl}/details): Visual breakdown of Omni AI's features and capabilities.
- [AI Arena](${siteUrl}/arena): Competitive AI agent arena for testing and benchmarking AI performance.
- [Interlinked](${siteUrl}/interlinked): Free training on building an AI CEO system for your business. Live webinar registration.
- [Pricing](${siteUrl}/pricing): Free tier + custom paid tiers. No per-seat pricing. Includes pricing FAQ.

## Products & Services
- [AI Lead Generation](${siteUrl}): Autonomous agents that find, qualify, and convert high-value leads.
- [AI Video Marketing](${siteUrl}/campaigns): AI scripts, produces, and edits marketing videos. Auto-tests and scales winners.
- [Business Automation](${siteUrl}): AI-powered operations management with memory, decision logic, and self-improvement.

## Newsletter
- [Interlinked Newsletter](${siteUrl}/newsletter): Free and premium AI strategy newsletters covering lead generation, automation, and business scaling.
- [RSS Feed](${siteUrl}/newsletter/rss.xml): Subscribe via RSS / Atom — last 50 issues with pubDate, tier, and intro.
- [Google News Sitemap](${siteUrl}/sitemap-news.xml): Last 48 hours of newsletter and trending-topic posts, formatted per Google News sitemap spec.

### Recent Issues
${recentIssuesBlock}

## FAQ
- **What is Omni AI?** Autonomous lead-generation and business-automation platform that runs AI agents 24/7.
- **How does Omni AI generate leads?** AI agents source contacts, produce outreach and video creative, qualify responses, and route qualified leads to your CRM or calendar.
- **What does Omni AI cost?** Free tier at omnileadsagi.com/join; paid tiers add autonomous outbound and priority compute.
- **Omni AI vs HubSpot, Apollo, Clay?** They record/enrich/compose. Omni AI actually runs the operation autonomously.
- **Who built Omni AI?** Sitani Mafi, founder. Founded in 2024.
- Full FAQ: ${siteUrl}/faq

## Compare
- [Compare Hub](${siteUrl}/vs): Directory of head-to-head comparisons against HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay.
- [Omni AI vs HubSpot](${siteUrl}/vs/hubspot): Keep HubSpot as the CRM of record; run Omni AI as the autonomous outbound + creative layer feeding it.
- [Omni AI vs Salesforce](${siteUrl}/vs/salesforce): Salesforce is the enterprise CRM of record; Omni AI fills the pipeline before it hits the CRM — no Salesforce admin required.
- [Omni AI vs Apollo](${siteUrl}/vs/apollo): Apollo gives you contacts; Omni AI replaces the sourcing + sequencing + creative loop without seat-based pricing.
- [Omni AI vs Outreach](${siteUrl}/vs/outreach): Outreach multiplies SDR teams; Omni AI replaces them entirely for teams under $5M ARR.
- [Omni AI vs Lemlist](${siteUrl}/vs/lemlist): Lemlist ships templates you wrote; Omni AI writes and ships the templates for you, then auto-promotes winners.
- [Omni AI vs Clay](${siteUrl}/vs/clay): Clay builds enrichment workflows; Omni AI ships the campaigns those workflows are supposed to feed.

## Founder
Sitani Mafi, Founder · Contact: sitanim8@gmail.com · Bio: ${siteUrl}/about

## Getting Started
- [Join / Sign Up](${siteUrl}/join): Create an account to access the Omni AI dashboard and tools.
- [Book a Strategy Call](${siteUrl}/book-now): Free 30-minute session with Omni AI operators.
- [Book a Demo](${siteUrl}/interlinked): Schedule a free demo to see how Omni AI integrates into your business.

## Partner Programs
- [Affiliate Program](${siteUrl}/affiliate/info): Earn 30% recurring commission on every referred Omni AI client. 90-day attribution, Net-30 payouts. Apply in 60 seconds.
- [Sponsor Program](${siteUrl}/sponsor/info): Partnership and sponsorship opportunities with Omni AI. Canonical public landing page for the sponsor program.

## Legal
- [Privacy Policy](${siteUrl}/privacy): How Omni AI collects, uses, stores, and shares personal information, plus your rights over your data.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Shorter edge cache than main sitemap (15 min) because the
      // Recent Issues section is the whole reason we went dynamic —
      // stale entries would defeat the point. stale-while-revalidate
      // keeps the endpoint available during Supabase hiccups.
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
