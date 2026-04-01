# GEO Audit Report — omnileadsagi.com

**Date:** March 31, 2026
**Target:** https://omnileadsagi.com
**Business Type:** SaaS / AI Platform
**Framework:** Next.js (SSR) on Vercel

---

## Composite GEO Score: 20/100 — CRITICAL

```
██░░░░░░░░░░░░░░░░░░ 20/100
```

The site is **virtually invisible** to AI search engines. Every major GEO category scored Critical or Poor. Immediate action is required across all dimensions.

### Score Breakdown

| Category | Score | Weight | Weighted | Status |
|----------|-------|--------|----------|--------|
| AI Citability & Visibility | 30/100 | 25% | 7.5 | 🔴 Poor |
| Brand Authority Signals | 5/100 | 20% | 1.0 | 🔴 Critical |
| Content Quality & E-E-A-T | 18/100 | 20% | 3.6 | 🔴 Critical |
| Technical Foundations | 38/100 | 15% | 5.7 | 🔴 Critical |
| Structured Data | 0/100 | 10% | 0.0 | 🔴 Critical |
| Platform Optimization | 22/100 | 10% | 2.2 | 🔴 Critical |
| **TOTAL** | | **100%** | **20.0** | **🔴 CRITICAL** |

---

## 1. AI Visibility Analysis

**AI Visibility Score: 30/100** — Poor

| Component | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Citability | 18/100 | 35% | 6.3 |
| Brand Mentions | 5/100 | 30% | 1.5 |
| Crawler Access | 90/100 | 25% | 22.5 |
| llms.txt | 0/100 | 10% | 0.0 |

### Citability Assessment — 18/100

The homepage has only **359 words** of marketing copy. No passage scores above 15/100 on citability. Zero statistical density. No answer blocks. No content an AI model could quote as a factual response.

| Content Block | Score | Failure Reason |
|--------------|-------|----------------|
| Hero tagline | 12/100 | Vague marketing claim, no data, not quotable |
| Service description | 14/100 | Generic capabilities, no evidence or specifics |
| CTA copy | 9/100 | Purely promotional, zero informational value |

### Crawler Access — 90/100

No robots.txt (404) = all AI crawlers allowed by default. Functional but unintentional.

| Crawler | Status |
|---------|--------|
| GPTBot (OpenAI) | ✅ Allowed |
| OAI-SearchBot | ✅ Allowed |
| ChatGPT-User | ✅ Allowed |
| ClaudeBot | ✅ Allowed |
| PerplexityBot | ✅ Allowed |
| Google-Extended | ✅ Allowed |
| All others | ✅ Allowed |

**Deduction:** -10 for no sitemap referenced.

### llms.txt — 0/100

No llms.txt file exists. AI crawlers have no structured guide to the site's content.

### Brand Mentions — 5/100

| Platform | Status | Details |
|----------|--------|---------|
| Wikipedia | ❌ Absent | No article. "Omni AI" conflicts with 6-8 other entities. |
| Reddit | ❌ Absent | Zero discussions found |
| YouTube | ❌ Absent | No channel or videos |
| LinkedIn | ❌ Absent | No company page |
| G2/Capterra/ProductHunt | ❌ Absent | No listings on any review platform |
| Industry Press | ❌ Absent | No TechCrunch, press, or news coverage |

**Critical naming issue:** "Omni AI" is an extremely crowded brand name. 6-8 other companies use it. AI models cannot disambiguate.

---

## 2. Platform Readiness Analysis

**Platform Readiness Average: 22/100** — Critical

| Platform | Score | Status |
|----------|-------|--------|
| Google AI Overviews | 18/100 | 🔴 Critical |
| ChatGPT Web Search | 24/100 | 🔴 Critical |
| Perplexity AI | 19/100 | 🔴 Critical |
| Google Gemini | 15/100 | 🔴 Critical |
| Bing Copilot | 26/100 | 🟡 Poor |

**Strongest:** Bing Copilot (26) — SSR + Vercel gives minimal technical edge
**Weakest:** Google Gemini (15) — Zero Google ecosystem presence (no YouTube, no GBP, no Knowledge Graph)

### Per-Platform Key Gaps

**Google AI Overviews (18/100):** No question-based headings, no answer-target patterns, no comparison tables, no structured data. Content too thin (359 words) for AIO extraction.

**ChatGPT Web Search (24/100):** No entity recognition (no Wikipedia, no Wikidata, no sameAs schema). No author bylines. No publication dates. No citable factual statements.

**Perplexity AI (19/100):** Zero community validation (no Reddit, no forums, no reviews). Not a primary source for any topic. No content freshness signals.

**Google Gemini (15/100):** Zero Google ecosystem presence. No YouTube, no Google Business Profile, no Knowledge Graph entity. No topical clustering.

**Bing Copilot (26/100):** No IndexNow, no Bing Webmaster verification, no LinkedIn company page, no structured data.

---

## 3. Technical Foundations

**Technical Score: 38/100** — Critical

| Category | Score | Weight | Weighted | Status |
|----------|-------|--------|----------|--------|
| Server-Side Rendering | 80/100 | 25% | 20.0 | ✅ PASS |
| Meta Tags & Indexability | 25/100 | 15% | 3.75 | ❌ FAIL |
| Crawlability | 5/100 | 15% | 0.75 | ❌ FAIL |
| Security Headers | 35/100 | 10% | 3.5 | ⚠️ WARN |
| Core Web Vitals Risk | 50/100 | 10% | 5.0 | ⚠️ WARN |
| Mobile Optimization | 70/100 | 10% | 7.0 | ⚠️ WARN |
| URL Structure | 85/100 | 5% | 4.25 | ✅ PASS |
| Response & Status | 80/100 | 5% | 4.0 | ✅ PASS |
| Additional Checks | 15/100 | 5% | 0.75 | ❌ FAIL |

### Critical Technical Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| No canonical tag | 🔴 CRITICAL | Ranking signals split between omnileadsagi.com and omni-ai-theta.vercel.app |
| OG URL points to Vercel preview | 🔴 CRITICAL | All social shares direct to wrong domain |
| No robots.txt | 🔴 CRITICAL | No sitemap reference for crawler discovery |
| No sitemap.xml | 🔴 CRITICAL | AI crawlers can't discover pages |
| No `lang` attribute | 🟡 HIGH | Language detection issues for crawlers |
| Meta description 96 chars | 🟡 HIGH | Should be 140-160 chars |
| Title only 34 chars | 🟡 HIGH | Should be 50-60 chars |
| Missing twitter:image | 🟡 HIGH | Large image cards show no image |
| 5 missing security headers | 🟡 MEDIUM | No CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Images without width/height | 🟡 MEDIUM | CLS risk |

### What's Working

- ✅ Next.js SSR confirmed — AI crawlers can read content
- ✅ HTTPS with strong HSTS (2 year max-age)
- ✅ Vercel edge CDN with gzip compression
- ✅ Clean URL structure
- ✅ 200 status, no redirect chains

---

## 4. Content Quality & E-E-A-T

**Content Score: 18/100** — Critical

### E-E-A-T Assessment — 20/100

| Dimension | Score | Key Evidence |
|-----------|-------|-------------|
| Experience | 3/25 | Zero original research, no case studies, no first-hand process documentation |
| Expertise | 4/25 | No author, no credentials, no technical depth beyond marketing claims |
| Authoritativeness | 5/25 | Unverified partner logos, no about page, no external validation |
| Trustworthiness | 8/25 | HTTPS present but no privacy policy, no contact info, unsourced statistics |

### Content Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Word Count | 359 | 🔴 Thin content (need 1,500+) |
| Readability (Flesch) | ~55 | Fairly Difficult — marketing jargon |
| Internal Links | ~2 | 🔴 Sparse — crawlers can't discover pages |
| External Citations | 0 | 🔴 Zero sources cited |
| Author Byline | None | 🔴 Anonymous content |
| Publication Date | None | 🔴 No freshness signals |

### AI Content Assessment

**Verdict: Likely AI with Light Editing**

| Indicator | Found |
|-----------|-------|
| Generic phrasing ("scale businesses", "compounds growth") | ✅ Yes |
| Lack of specifics (no real names, dates, figures) | ✅ Yes |
| No original data | ✅ Yes |
| Perfect structure, empty substance | ✅ Yes |
| No authorial voice | ✅ Yes |
| Repetitive thesis ("autonomous", "without human input") | ✅ Yes |

### Topical Authority — Minimal

- 0 supporting content pages (no blog, docs, help center, case studies)
- 0% topic coverage for "AI lead generation" topic space
- No hub/cluster content architecture

---

## 5. Schema & Structured Data

**Schema Score: 0/100** — Critical

**Total Schema Blocks Found: 0**
No JSON-LD. No Microdata. No RDFa. Nothing.

### Missing GEO-Critical Schemas

| Schema | Status | GEO Impact |
|--------|--------|-----------|
| Organization + sameAs | ❌ Missing | CRITICAL — No entity identity |
| SoftwareApplication | ❌ Missing | CRITICAL — Product invisible to AI |
| WebSite + SearchAction | ❌ Missing | HIGH — No site-level identity |
| Person (authors/founders) | ❌ Missing | HIGH — Zero E-E-A-T signals |
| Article (newsletters) | ❌ Missing | HIGH — Content not typed |
| BreadcrumbList | ❌ Missing | MEDIUM — No navigation hierarchy |
| speakable | ❌ Missing | MEDIUM — Not marked for AI assistants |

### sameAs Entity Linking — 0 Platforms

| Platform | Linked |
|----------|--------|
| Wikipedia | ❌ |
| Wikidata | ❌ |
| LinkedIn | ❌ |
| YouTube | ❌ |
| Crunchbase | ❌ |
| Twitter/X | ❌ |
| GitHub | ❌ |

**Note:** Next.js SSR is the ideal framework for schema delivery. All JSON-LD will be server-rendered and visible to AI crawlers. The infrastructure is ready; the data just needs to be added.

---

## Prioritized Action Plan

### 🔴 CRITICAL — Do Immediately (Week 1)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Add canonical tag** `<link rel="canonical" href="https://omnileadsagi.com/">` to all pages | Stops ranking signal split with Vercel preview URL | Low |
| 2 | **Fix OG URL** from `omni-ai-theta.vercel.app` to `omnileadsagi.com` | Fixes all social share previews | Low |
| 3 | **Create robots.txt** with sitemap reference + explicit AI crawler allows | Enables crawler discovery | Low |
| 4 | **Create sitemap.xml** listing all indexable pages with `<lastmod>` dates | AI crawlers discover all pages | Low |
| 5 | **Add Organization JSON-LD** with name, url, logo, description, contactPoint | Establishes entity identity for AI models | Low |
| 6 | **Add SoftwareApplication JSON-LD** with features, reviews, offers | Product becomes discoverable | Low |
| 7 | **Add `lang="en"` to `<html>` tag** | Language detection fix | Trivial |
| 8 | **Add `twitter:image` meta tag** | Fixes Twitter card previews | Trivial |

### 🟠 HIGH — Do This Month (Weeks 2-4)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 9 | **Expand homepage to 1,500+ words** with question-based H2s, answer-target paragraphs, comparison tables, process lists | Transforms citability from 18→60+ | Medium |
| 10 | **Add privacy policy, terms of service, contact page** with real address/email/phone | Baseline trustworthiness | Low |
| 11 | **Create About page** with founder name, photo, credentials, LinkedIn link | E-E-A-T foundation | Low |
| 12 | **Expand meta title to 50-60 chars** (e.g., "Omni AI — Autonomous Lead Generation & Business Automation") | Better search snippet control | Trivial |
| 13 | **Expand meta description to 140-160 chars** with value prop and CTA | Better search click-through | Trivial |
| 14 | **Create llms.txt and llms-full.txt** at domain root | Direct AI crawler guidance | Low |
| 15 | **Add security headers** (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | Trust + security signals | Low |
| 16 | **Create LinkedIn company page** for Omni AI | Entity presence + Bing Copilot signal | Low |
| 17 | **Add Article JSON-LD with speakable** to all newsletter pages | Newsletter content typed for AI | Medium |
| 18 | **Enable IndexNow on Vercel** + verify in Bing Webmaster Tools | Real-time Bing indexing | Low |

### 🟡 MEDIUM — Do Within 90 Days

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 19 | **Build topical content cluster** (8-12 interlinked pages, 1,500+ words each) covering AI lead gen, automation, operations | Topical authority for all platforms | High |
| 20 | **Launch YouTube channel** with 5-10 product/topic videos | Google Gemini + AIO visibility | High |
| 21 | **Register on Crunchbase, Product Hunt, G2, Capterra** | Third-party entity validation | Medium |
| 22 | **Publish original research/data** (AI lead gen benchmarks, state of automation report) | Primary source for Perplexity/ChatGPT | High |
| 23 | **Launch Reddit presence** in r/SaaS, r/artificial, r/Entrepreneur | Perplexity community validation | Medium |
| 24 | **Add author bylines + Person schema** to all content with credentials and LinkedIn links | E-E-A-T across all content | Medium |
| 25 | **Source all statistical claims** ("500k+ Subscribers", "20M+ Impressions") with verifiable methodology | Trustworthiness + citability | Low |
| 26 | **Create Google Business Profile** | Google ecosystem entity establishment | Low |
| 27 | **Address "Omni AI" brand naming collision** — consistently use "OmniLeads AGI" or differentiate | Entity disambiguation for AI models | Strategic |

---

## Projected Impact

If all Critical + High actions are completed:

| Category | Current | Projected | Change |
|----------|---------|-----------|--------|
| AI Citability & Visibility | 30 | 60-65 | +100% |
| Brand Authority Signals | 5 | 30-35 | +500% |
| Content Quality & E-E-A-T | 18 | 50-55 | +175% |
| Technical Foundations | 38 | 75-80 | +100% |
| Structured Data | 0 | 75-80 | +∞ |
| Platform Optimization | 22 | 45-50 | +115% |
| **Composite GEO Score** | **20** | **55-60** | **+175%** |

With Medium-term actions (90 days), projected GEO Score: **70-80/100 (Good)**

---

*Report generated by GEO-SEO Claude Code Skill*
*Methodology: 5-agent parallel analysis (AI Visibility, Platform Readiness, Technical SEO, Content Quality, Schema)*
