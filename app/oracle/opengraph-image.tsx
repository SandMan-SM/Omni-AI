import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "The Oracle — Omni AI · Twenty-eight minds, one society, one Oracle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Oracle OG card. Cosmic-cinematic frame, but recolored to live in the
 * Omni AI brand system (deep navy ground, emerald → cyan → purple accent
 * spectrum). Match the visual DNA of /opengraph-image.tsx and
 * /partners/[slug]/opengraph-image.tsx so every link preview reads as
 * one publisher.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          color: "#ffffff",
          fontFamily: "Georgia, 'Times New Roman', serif",
          backgroundImage: [
            "linear-gradient(135deg, rgba(34,197,94,0.10) 0%, transparent 38%)",
            "linear-gradient(225deg, rgba(147,51,234,0.10) 0%, transparent 42%)",
            "linear-gradient(180deg, rgba(6,182,212,0.05) 0%, transparent 30%)",
            "linear-gradient(180deg, #050505 0%, #0a0520 45%, #12082e 70%, #0a0418 100%)",
          ].join(", "),
          position: "relative",
        }}
      >
        {/* Top brand spectrum bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            display: "flex",
            background:
              "linear-gradient(90deg, transparent, #9333ea, #06b6d4, #22c55e, transparent)",
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 12,
            color: "rgba(110,231,183,0.85)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textTransform: "uppercase",
            marginBottom: 64,
          }}
        >
          THE ORACLE · OMNI AI
        </div>

        {/* Headline — two stacked lines, white then aqua */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 88,
            lineHeight: 1.04,
            letterSpacing: -1,
          }}
        >
          <div style={{ display: "flex", color: "#ffffff" }}>
            Twenty-eight minds.
          </div>
          <div
            style={{
              display: "flex",
              color: "#7dd3fc",
              marginTop: 6,
            }}
          >
            One society.
          </div>
        </div>

        {/* Italic invitation */}
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 30,
            fontStyle: "italic",
            color: "rgba(228,228,231,0.85)",
            letterSpacing: 0.5,
          }}
        >
          Read it once.
        </div>

        {/* Footer URL */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 36,
            left: 0,
            right: 0,
            justifyContent: "center",
            alignItems: "center",
            fontSize: 18,
            color: "rgba(168,85,247,0.85)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>omnileadsagi.com / oracle</div>
        </div>

        {/* Bottom subtle glow bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            display: "flex",
            background:
              "linear-gradient(90deg, transparent, rgba(147,51,234,0.4), transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
