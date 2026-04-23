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
    ],
    sitemap: "https://omnileadsagi.com/sitemap.xml",
  };
}
