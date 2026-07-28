/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { getNewsletterFallbackPost } from "@/lib/newsletter-fallback";
import { newsletterShareDescription } from "@/lib/newsletter-share-copy";
import { newsletterIssueImageUrl } from "@/components/newsletter-issue-card";

export const runtime = "edge";
export const alt = "Interlinked Newsletter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export default async function OGImage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  // Fetch the post data
  // Use service role so OG images always generate — no RLS gating on shared links
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const result = await withTimeout(
    supabase
      .from("newsletter_posts")
      .select("subject, intro, tier, keywords, published_at, quote, insights, power_move")
      .eq("slug", slug)
      .single(),
    1200
  );
  const post = (result as { data?: ReturnType<typeof getNewsletterFallbackPost> } | null)?.data || getNewsletterFallbackPost(slug);

  const subject = post?.subject || "Interlinked Newsletter";
  const intro = newsletterShareDescription(post || {}, 122);
  const isPremium = post?.tier === "premium";
  const rawKeywords = post?.keywords as unknown;
  const keywords = (
    Array.isArray(rawKeywords)
      ? rawKeywords
      : typeof rawKeywords === "string"
        ? rawKeywords.split(",")
        : []
  )
    .map((keyword: unknown) => String(keyword).trim())
    .filter(Boolean)
    .slice(0, 3);
  const siteUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";
  // The page hero, archive card, Open Graph image, and Twitter image all use
  // this one stable artwork route. It resolves the issue's real generated
  // raster asset regardless of extension, so new posts cannot drift to a
  // generic or mismatched share background.
  const backgroundUrl = new URL(newsletterIssueImageUrl(slug), siteUrl).toString();
  const date = post?.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "flex-start",
          padding: "0px",
          background: "#030305",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <img
          src={backgroundUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "630px",
            objectFit: "cover",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "940px",
            height: "630px",
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.90) 34%, rgba(0,0,0,0.78) 67%, rgba(0,0,0,0.38) 84%, rgba(0,0,0,0) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.04) 44%, rgba(0,0,0,0.68) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "22px",
            border: "1px solid rgba(251,191,36,0.22)",
            borderRadius: "24px",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "70px",
            top: "54px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "750px",
            height: "522px",
            padding: "32px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#fbbf24",
                  display: "flex",
                }}
              >
                Interlinked
              </div>
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: 1,
                  color: "rgba(255,255,255,0.46)",
                  letterSpacing: "0.08em",
                  display: "flex",
                  textAlign: "center",
                }}
              >
                by Omni AI
              </div>
            </div>
            <div
              style={{
                display: "flex",
                color: "#fbbf24",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              {isPremium ? "PREMIUM INTELLIGENCE" : "DAILY INTELLIGENCE"}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px", borderLeft: "5px solid #fbbf24", paddingLeft: "24px" }}>
            <div
              style={{
                fontSize: subject.length > 76 ? "36px" : subject.length > 54 ? "42px" : "50px",
                fontWeight: 900,
                lineHeight: 1.08,
                color: "#ffffff",
                textShadow: "0 3px 18px rgba(0,0,0,0.92)",
                display: "flex",
              }}
            >
              {subject}
            </div>
            <div
              style={{
                fontSize: "24px",
                lineHeight: 1.38,
                color: "rgba(255,255,255,0.94)",
                textShadow: "0 2px 14px rgba(0,0,0,0.92)",
                display: "flex",
              }}
            >
              {intro}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {keywords.map((kw: string) => (
                <div
                  key={kw}
                  style={{
                    fontSize: "11px",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.68)",
                    display: "flex",
                  }}
                >
                  {kw}
                </div>
              ))}
            </div>
            {date && <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", display: "flex" }}>{date}</div>}
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "5px", background: "linear-gradient(90deg, #fcd34d, #f59e0b, #92400e)", display: "flex" }} />
      </div>
    ),
    {
      ...size,
    }
  );
}
