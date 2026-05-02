import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "The Oracle — Omni AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.18) 0%, rgba(0,0,0,1) 55%), #000",
          padding: 80,
          color: "#ffffff",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "rgba(251,191,36,0.7)",
            marginBottom: 40,
          }}
        >
          THE ORACLE · OMNI AI
        </div>
        <div
          style={{
            fontSize: 76,
            lineHeight: 1.05,
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>You are not looking</span>
          <span>at software.</span>
          <span style={{ color: "#fde68a" }}>You are looking at a</span>
          <span style={{ color: "#fde68a" }}>society of minds.</span>
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 2,
          }}
        >
          <div>omnileadsagi.com / oracle</div>
          <div style={{ fontStyle: "italic" }}>read once.</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
