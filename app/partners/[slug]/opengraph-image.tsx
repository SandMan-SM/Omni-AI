import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; // needs the admin client (uses Node crypto)
export const alt = "Omni AI × Partner — Agentic Growth Partnership";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Per-partner OG card. Dynamically resolves the partner's display name
 * from omni_businesses by slug, then renders an Omni AI × <Partner> lockup
 * over the canonical brand gradient (deep navy ground, emerald → cyan →
 * purple accents). Falls back to "Omni AI Partners" for unknown slugs.
 *
 * Visual DNA matches /opengraph-image.tsx (root) and /oracle/opengraph-image.tsx
 * so every Omni AI link preview reads as one publisher.
 */
export default async function Image({ params }: { params: { slug: string } }) {
  const slug = (params.slug || "").trim();

  let partnerName = "Omni AI Partners";
  let partnerLine = "Agentic Growth Partnership";
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("omni_businesses")
      .select("name, industry")
      .or(`slug.ilike.${slug},name.ilike.${slug}`)
      .limit(1)
      .maybeSingle();
    if (data?.name) {
      partnerName = data.name;
      partnerLine = data.industry
        ? `Agentic Growth Partnership · ${data.industry}`
        : "Agentic Growth Partnership";
    }
  } catch {
    /* fallback to defaults */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(145deg, #050505 0%, #0a0520 30%, #12082e 50%, #0a0418 70%, #050505 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          padding: "0 80px",
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

        {/* Soft accent glow upper-left */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 80,
            width: 540,
            height: 320,
            display: "flex",
            background:
              "linear-gradient(135deg, rgba(34,197,94,0.20) 0%, rgba(6,182,212,0.10) 50%, transparent 80%)",
            filter: "blur(10px)",
          }}
        />

        {/* Soft accent glow lower-right */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            width: 540,
            height: 320,
            display: "flex",
            background:
              "linear-gradient(225deg, rgba(147,51,234,0.20) 0%, rgba(168,85,247,0.10) 50%, transparent 80%)",
            filter: "blur(10px)",
          }}
        />

        {/* Decorative dots */}
        <div style={{ position: "absolute", top: 90, left: 110, width: 14, height: 14, borderRadius: 7, background: "rgba(147,51,234,0.6)", display: "flex" }} />
        <div style={{ position: "absolute", top: 170, left: 210, width: 8, height: 8, borderRadius: 4, background: "rgba(168,85,247,0.4)", display: "flex" }} />
        <div style={{ position: "absolute", top: 130, left: 1050, width: 10, height: 10, borderRadius: 5, background: "rgba(6,182,212,0.5)", display: "flex" }} />
        <div style={{ position: "absolute", top: 310, left: 1090, width: 6, height: 6, borderRadius: 3, background: "rgba(34,197,94,0.45)", display: "flex" }} />
        <div style={{ position: "absolute", top: 490, left: 150, width: 9, height: 9, borderRadius: 5, background: "rgba(6,182,212,0.35)", display: "flex" }} />
        <div style={{ position: "absolute", top: 420, left: 1020, width: 7, height: 7, borderRadius: 4, background: "rgba(147,51,234,0.3)", display: "flex" }} />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 16,
            letterSpacing: 8,
            color: "rgba(110,231,183,0.95)",
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 36,
          }}
        >
          Agentic Partnership
        </div>

        {/* Co-brand lockup — Omni AI × <Partner> */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 28,
            justifyContent: "center",
            flexWrap: "wrap",
            maxWidth: 1040,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -2,
              backgroundImage:
                "linear-gradient(90deg, #6ee7b7, #67e8f9, #93c5fd)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1,
            }}
          >
            Omni AI
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 64,
              color: "rgba(148,163,184,0.7)",
              lineHeight: 1,
            }}
          >
            ×
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -2,
              color: "#ffffff",
              lineHeight: 1,
              maxWidth: 720,
            }}
          >
            {partnerName}
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: "rgba(226,232,240,0.85)",
            fontWeight: 500,
            letterSpacing: -0.2,
            textAlign: "center",
            maxWidth: 920,
          }}
        >
          {partnerLine}
        </div>

        {/* Pills row */}
        <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
          {[
            { dot: "#22c55e", label: "Autonomous Lead Gen" },
            { dot: "#06b6d4", label: "Live Site Analytics" },
            { dot: "#a855f7", label: "Newsletter Engine" },
          ].map(({ dot, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: dot,
                  marginRight: 10,
                  display: "flex",
                }}
              />
              <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: "absolute",
            bottom: 26,
            display: "flex",
            alignItems: "center",
            color: "rgba(148,163,184,0.65)",
            fontSize: 15,
            letterSpacing: 3,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", color: "rgba(168,85,247,0.95)" }}>
            omnileadsagi.com
          </div>
          <div style={{ display: "flex", margin: "0 14px", color: "rgba(100,116,139,0.6)" }}>·</div>
          <div style={{ display: "flex" }}>partners / {slug}</div>
        </div>

        {/* Bottom soft bar */}
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
