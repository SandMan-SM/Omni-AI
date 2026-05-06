// /manifesto OG card — paper-feel, the manifesto's strongest line as
// the headline. Used for LinkedIn / X / Slack / iMessage unfurls when
// https://omnileadsagi.com/manifesto is shared.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Interlinked — The Manifesto. We are not here to help you manage your stress. We are here to dissolve the machinery that produces it.";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#050505",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#fafafa",
        }}
      >
        {/* Top-left chrome-gold glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 720,
            height: 720,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.32), rgba(251,191,36,0))",
            display: "flex",
          }}
        />
        {/* Bottom-right warm rose glow */}
        <div
          style={{
            position: "absolute",
            bottom: -260,
            right: -200,
            width: 660,
            height: 660,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(244,63,94,0.18), rgba(244,63,94,0))",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 72px",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Top eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 18,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#fbbf24",
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Interlinked · A Manifesto by Omni AI
          </div>

          {/* The line */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.18,
              color: "#fafafa",
              maxWidth: 1020,
              display: "flex",
            }}
          >
            We are not here to help you manage your stress. We are here
            to dissolve the machinery that produces it.
          </div>

          {/* Footer row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 18,
                color: "#a8a29e",
              }}
            >
              <div style={{ color: "#fbbf24", fontWeight: 800, letterSpacing: 2 }}>
                LIBERATION OF ATTENTION
              </div>
              <div>Read the full essay →</div>
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#fafafa",
              }}
            >
              omnileadsagi.com/manifesto
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
