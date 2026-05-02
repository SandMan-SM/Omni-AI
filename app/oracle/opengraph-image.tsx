import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "The Oracle — Omni AI · A society of minds that compounds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori notes (Next.js OG image renderer):
 *   - Every element with multiple children OR a text node must declare
 *     `display: 'flex'` (or 'none'). No implicit block layout.
 *   - `radial-gradient` is supported but flaky on edge cold-starts;
 *     `linear-gradient` is the safer choice for production.
 *   - System fonts are limited; we lean on the default sans-serif and
 *     a Georgia-style serif heading (Vercel's default serif fallback
 *     handles it without a network fetch).
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
          padding: "80px",
          color: "#ffffff",
          fontFamily: "Georgia, 'Times New Roman', serif",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1c1917 35%, #0a0a0a 70%, #1a1208 100%)",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 8,
            color: "rgba(251,191,36,0.75)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          THE ORACLE · OMNI AI
        </div>

        {/* Headline block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 60,
            fontSize: 76,
            lineHeight: 1.05,
          }}
        >
          <div style={{ display: "flex", color: "#ffffff" }}>
            You are not looking
          </div>
          <div style={{ display: "flex", color: "#ffffff" }}>at software.</div>
          <div style={{ display: "flex", color: "#fde68a", marginTop: 18 }}>
            You are looking at a
          </div>
          <div style={{ display: "flex", color: "#fde68a" }}>
            society of minds.
          </div>
        </div>

        {/* Spacer + footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "rgba(255,255,255,0.55)",
            fontSize: 20,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 1.5,
          }}
        >
          <div style={{ display: "flex" }}>omnileadsagi.com / oracle</div>
          <div style={{ display: "flex", fontStyle: "italic" }}>read once.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
