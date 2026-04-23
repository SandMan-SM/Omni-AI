import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "AI Is Changing Everything";
  const topic = searchParams.get("topic") || "AI & Business Automation";
  // Optional eyebrow override so /newsletter/[slug] cards can read
  // "Omni AI · Interlinked" instead of the default "Trending Now" used
  // by the daily landing pages. Both paths share the same OG generator
  // so the brand art stays identical; only the eyebrow copy varies.
  const eyebrow =
    searchParams.get("eyebrow") || "Omni AI · Trending Now";

  // Truncate title for display
  const displayTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
  const displayTopic = topic.length > 80 ? topic.slice(0, 77) + "..." : topic;
  const displayEyebrow =
    eyebrow.length > 40 ? eyebrow.slice(0, 37) + "..." : eyebrow;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#050508",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background glow left */}
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
            top: -250,
            left: -200,
          }}
        />
        {/* Background glow right */}
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)",
            bottom: -150,
            right: -150,
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 5,
            background: "linear-gradient(90deg, #6366f1, #ec4899, #06b6d4)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 80px",
            gap: 0,
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.35)",
              borderRadius: 100,
              padding: "6px 18px",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#818cf8",
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#a5b4fc",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {displayEyebrow}
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: displayTitle.length > 40 ? 62 : 72,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, #c4b5fd 0%, #f0abfc 45%, #67e8f9 100%)",
              backgroundClip: "text",
              color: "transparent",
              marginBottom: 24,
              maxWidth: 1000,
            }}
          >
            {displayTitle}
          </div>

          {/* Topic */}
          <div
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.5)",
              fontWeight: 400,
              maxWidth: 700,
              lineHeight: 1.5,
              marginBottom: 40,
            }}
          >
            {displayTopic}
          </div>

          {/* CTA pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "linear-gradient(135deg, #6366f1, #ec4899)",
              borderRadius: 100,
              padding: "14px 32px",
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: "white" }}>
              omnileadsagi.com →
            </span>
          </div>
        </div>

        {/* Bottom brand strip */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>
            Powered by Omni AI
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
