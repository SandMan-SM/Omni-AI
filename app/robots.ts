import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Defense-in-depth — each of these paths also sets
        // robots.index:false at the layout level, so a crawler that
        // ignores the sitewide rules still sees the noindex meta. But
        // a disallow here stops compliant crawlers before they make
        // the request at all, saving crawl budget and (more important)
        // not tipping off pattern-matching bots that an admin /
        // command surface even exists at that URL.
        //   /api/          — all server routes, no human-readable UI
        //   /admin/        — Supabase-authed admin console
        //   /dashboard/    — authed customer dashboard
        //   /auth/         — SSO callback + magic-link handlers
        //   /command/      — synthetic intelligence command center
        //   /void-preview/ — internal hero component preview
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/auth/",
          "/command/",
          "/void-preview/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
      {
        userAgent: "Amazonbot",
        allow: "/",
      },
      {
        userAgent: "Applebot-Extended",
        allow: "/",
      },
      {
        userAgent: "Bytespider",
        allow: "/",
      },
      {
        userAgent: "CCBot",
        allow: "/",
      },
      {
        userAgent: "Cohere-ai",
        allow: "/",
      },
      // Explicit allow for every major LLM + AI-assist crawler whose user
      // agent string we've confirmed in the wild. Pattern-matching defaults
      // ("*" allow) would cover these too, but named rules are the signal
      // Google + compliance-auditing tooling look for when ranking a site
      // as AI-friendly. Missing an AI crawler from the allow-list won't
      // block it — but listing it signals the site owner has intentionally
      // consented, which nudges retrieval weighting in a few engines.
      { userAgent: "anthropic-ai", allow: "/" },       // Older Anthropic bot, still seen
      { userAgent: "Claude-Web", allow: "/" },          // Alt Anthropic user agent
      { userAgent: "Claude-SearchBot", allow: "/" },    // Anthropic search indexer
      { userAgent: "DuckAssistBot", allow: "/" },       // DuckDuckGo's AI assist
      { userAgent: "Meta-ExternalAgent", allow: "/" },  // Meta / Llama training
      { userAgent: "Meta-ExternalFetcher", allow: "/" },// Meta on-demand fetch
      { userAgent: "FacebookBot", allow: "/" },         // Facebook AI indexer
      { userAgent: "YouBot", allow: "/" },              // You.com retrieval
      { userAgent: "Diffbot", allow: "/" },             // Diffbot knowledge graph
      { userAgent: "PetalBot", allow: "/" },            // Huawei AI assistant
      { userAgent: "Timpibot", allow: "/" },            // Mistral-affiliated crawler
      { userAgent: "MistralAI-User", allow: "/" },      // Mistral Le Chat
      { userAgent: "Google-CloudVertexBot", allow: "/" },// Vertex AI training
      { userAgent: "AndiBot", allow: "/" },             // Andi search
      { userAgent: "PhindBot", allow: "/" },            // Phind developer search
      { userAgent: "ImagesiftBot", allow: "/" },        // Image enrichment for LLMs
      { userAgent: "Kagibot", allow: "/" },             // Kagi search
    ],
    sitemap: "https://omnileadsagi.com/sitemap.xml",
  };
}
