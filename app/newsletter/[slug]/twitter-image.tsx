import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const alt = "Interlinked Newsletter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TwitterImage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  // Use service role so Twitter cards always generate — no RLS gating on shared links
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: post } = await supabase
    .from("newsletter_posts")
    .select("subject, intro, tier, keywords, published_at")
    .eq("slug", slug)
    .single();

  const subject = post?.subject || "Interlinked Newsletter";
  const intro = post?.intro?.slice(0, 120) || "AI intelligence brief by Omni AI";
  const isPremium = post?.tier === "premium";
  const keywords = (post?.keywords || []).slice(0, 5);
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
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          background: "linear-gradient(145deg, #0a0a12 0%, #0d0d1a 40%, #12091f 70%, #0a0a12 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: isPremium
              ? "radial-gradient(circle, rgba(234,179,8,0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-60px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #a855f7, #3b82f6, #06b6d4)",
                backgroundClip: "text",
                color: "transparent",
                display: "flex",
              }}
            >
              Interlinked
            </div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em", display: "flex" }}>
              by Omni AI
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 20px",
              borderRadius: "8px",
              background: isPremium ? "rgba(234,179,8,0.12)" : "rgba(168,85,247,0.12)",
              border: isPremium ? "1px solid rgba(234,179,8,0.25)" : "1px solid rgba(168,85,247,0.25)",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: isPremium ? "#eab308" : "#a855f7",
                display: "flex",
              }}
            >
              {isPremium ? "Premium" : "Free"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1, justifyContent: "center" }}>
          <div
            style={{
              fontSize: subject.length > 50 ? "42px" : "50px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              color: "#ffffff",
              display: "flex",
              maxWidth: "900px",
            }}
          >
            {subject}
          </div>
          <div style={{ fontSize: "18px", lineHeight: 1.5, color: "rgba(255,255,255,0.5)", display: "flex", maxWidth: "800px" }}>
            {intro.length > 120 ? intro.slice(0, 117) + "..." : intro}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {keywords.map((kw: string) => (
              <div
                key={kw}
                style={{
                  fontSize: "12px",
                  padding: "5px 14px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.45)",
                  display: "flex",
                }}
              >
                {kw}
              </div>
            ))}
          </div>
          {date && <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", display: "flex" }}>{date}</div>}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: isPremium
              ? "linear-gradient(90deg, #eab308, #f59e0b, #eab308)"
              : "linear-gradient(90deg, #a855f7, #3b82f6, #06b6d4)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
