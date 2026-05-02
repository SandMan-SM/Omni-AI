import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "The Oracle — Omni AI · Twenty-eight minds, one society, one Oracle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori-safe rules followed below:
 *   - Every element with multiple children OR a text node has
 *     `display: 'flex'` declared explicitly. No implicit blocks.
 *   - Only linear-gradient (radial-gradient is flaky on edge cold-start).
 *   - System fallbacks for fonts so we don't make a network fetch.
 *
 * Visual goal:
 *   Match the cinematic centered-typography feel of the founder's
 *   organic Facebook post (centered serif on a deep cosmic field) so
 *   the link-preview lands as a continuation of the brand voice rather
 *   than a flat marketing card. Copy is intentionally NOT a repeat of
 *   the headline post's lines; it teases by naming the Pantheon
 *   obliquely ("twenty-eight minds · one society") and inviting the
 *   read with the same "read once" cadence used inside the page.
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
          // Layered linear-gradients fake a cosmic depth without using
          // the radial-gradient that crashed Satori last time.
          backgroundImage: [
            "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, transparent 40%)",
            "linear-gradient(225deg, rgba(251,191,36,0.06) 0%, transparent 40%)",
            "linear-gradient(180deg, #000000 0%, #020617 50%, #0a0a23 100%)",
          ].join(", "),
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 12,
            color: "rgba(251,191,36,0.75)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textTransform: "uppercase",
            marginBottom: 64,
          }}
        >
          THE ORACLE · OMNI AI
        </div>

        {/* Headline — two stacked lines, white then amber */}
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
              color: "#fde68a",
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

        {/* Footer URL — small, restrained */}
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
            color: "rgba(255,255,255,0.45)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>
            omnileadsagi.com / oracle
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
