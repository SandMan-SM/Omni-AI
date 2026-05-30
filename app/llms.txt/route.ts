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
export const dynamic = "force-dynamic";

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

Omni AI (omnileadsagi.com) is an autonomous lead-generation and business-automation platform founded in 2024 by Alfred Belvedere. It deploys AI agents that generate leads, produce video marketing, run outbound campaigns, and scale operations 24/7 without ongoing human supervision. The platform offers a free tier and paid subscriptions. Book a strategy call at omnileadsagi.com/book-now.

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

**What is Omni AI?**
Omni AI is an autonomous lead-generation and business-automation platform founded in 2024 by Alfred Belvedere. It deploys AI agents that generate leads, produce video marketing, run outbound campaigns, and scale operations 24/7 without ongoing human supervision. The platform is available at ${siteUrl} with a free tier and paid subscriptions.

**How does Omni AI generate leads?**
Omni AI's agents source contacts from verified B2B databases and public enrichment APIs, produce personalized outreach and video creative, qualify responses, and route qualified leads to your CRM or calendar. The system learns from each campaign's results and auto-optimizes — every cycle compounds instead of starting from zero. No SDR team is required.

**What does Omni AI cost?**
The free tier at ${siteUrl}/join includes campaign generation, the AI Agent Arena for benchmarking, daily trending content, and community support. Paid tiers add autonomous outbound, priority model access, custom integrations, and Interlinked Premium. Pricing is flat — no per-seat multipliers. Book a strategy call at ${siteUrl}/book-now for a tier mapped to your revenue target.

**Is Omni AI better than HubSpot, Apollo, or Clay?**
They solve different problems. HubSpot is a CRM that records activity after it happens; Apollo is a contact database with basic sequencing; Clay is an enrichment workflow builder. Omni AI runs the operation autonomously — it decides what to send, produces the creative, ships the campaign, and adjusts without waiting for a human to rebuild a workflow. Most teams keep their CRM and replace their outbound/ops stack with Omni AI.

**Who built Omni AI?**
Omni AI was founded in 2024 by Alfred Belvedere, a solo operator who built the platform to replace the SDR/ads/video/analytics stack with a single coordinated system. Contact: alfred@omnileadsagi.com. Founder bio and company history at ${siteUrl}/about.

**Is there a free tier?**
Yes. The free tier at ${siteUrl}/join unlocks campaign generation, the AI Agent Arena for head-to-head agent benchmarking, daily trending content, and community support. Most operators validate the platform on the free tier before upgrading to paid outbound.

**How long until I see leads?**
Most operators see their first qualified leads within the first week on the free tier. Full revenue lift typically shows within 30 days once the system has enough cycle data to self-optimize. Book a 30-minute strategy call at ${siteUrl}/book-now for a timeline mapped to your specific revenue target.

**What integrations does Omni AI support?**
Omni AI integrates with HubSpot, Salesforce, Google Workspace, Microsoft 365, LinkedIn, Meta Ads, Google Ads, Stripe, and Calendar (Google / Microsoft / Calendly). Custom integrations are available on paid tiers. The platform is API-first — if your stack speaks REST or webhooks, it connects.

**What industries does Omni AI work for?**
Omni AI is industry-agnostic — the platform runs for B2B SaaS, marketing agencies, local service businesses (HVAC, med spa, roofing, contracting), fitness and wellness, real estate, consulting, and professional services. Any business that needs qualified leads and outbound at volume is a fit.

**How is Omni AI different from hiring an agency?**
An agency charges $5K–$25K per month, caps at its team's bandwidth, and takes weeks to adjust when strategy shifts. Omni AI runs 24/7 at a fixed cost, adjusts in hours not weeks, and never has turnover. For most sub-$5M ARR operations Omni AI delivers the agency workflow autonomously at a fraction of the cost; agencies remain better when a team specifically needs human-in-the-loop creative.

Full FAQ with additional questions on GDPR, AI-model routing, and autopilot safety: ${siteUrl}/faq

## Compare
- [Compare Hub](${siteUrl}/vs): Directory of head-to-head comparisons against HubSpot, Salesforce, Apollo, Outreach, Lemlist, and Clay.
- [Omni AI vs HubSpot](${siteUrl}/vs/hubspot): Keep HubSpot as the CRM of record; run Omni AI as the autonomous outbound + creative layer feeding it.
- [Omni AI vs Salesforce](${siteUrl}/vs/salesforce): Salesforce is the enterprise CRM of record; Omni AI fills the pipeline before it hits the CRM — no Salesforce admin required.
- [Omni AI vs Apollo](${siteUrl}/vs/apollo): Apollo gives you contacts; Omni AI replaces the sourcing + sequencing + creative loop without seat-based pricing.
- [Omni AI vs Outreach](${siteUrl}/vs/outreach): Outreach multiplies SDR teams; Omni AI replaces them entirely for teams under $5M ARR.
- [Omni AI vs Lemlist](${siteUrl}/vs/lemlist): Lemlist ships templates you wrote; Omni AI writes and ships the templates for you, then auto-promotes winners.
- [Omni AI vs Clay](${siteUrl}/vs/clay): Clay builds enrichment workflows; Omni AI ships the campaigns those workflows are supposed to feed.

## Founder
Alfred Belvedere, Founder · Contact: alfred@omnileadsagi.com · Bio: ${siteUrl}/about

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
