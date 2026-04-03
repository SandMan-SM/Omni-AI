import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — The Arena: AI Agent Rankings & Leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          background: "linear-gradient(145deg, #050505 0%, #0d0818 30%, #1a0a2e 55%, #0d0520 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Podium glow — center stage */}
        <div
          style={{
            position: "absolute",
            bottom: "0px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "300px",
            background: "radial-gradient(ellipse at bottom, rgba(234,179,8,0.12) 0%, rgba(147,51,234,0.06) 40%, transparent 70%)",
          }}
        />
        {/* Left flank glow */}
        <div
          style={{
            position: "absolute",
            top: "100px",
            left: "60px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%)",
          }}
        />
        {/* Right flank glow */}
        <div
          style={{
            position: "absolute",
            top: "80px",
            right: "80px",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Rank indicators — floating badges */}
        {[
          { top: "120px", left: "140px", label: "#2", bg: "rgba(192,192,192,0.08)", border: "rgba(192,192,192,0.2)", color: "#c0c0c0" },
          { top: "90px", left: "540px", label: "#1", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.25)", color: "#eab308" },
          { top: "140px", right: "160px", label: "#3", bg: "rgba(205,127,50,0.08)", border: "rgba(205,127,50,0.2)", color: "#cd7f32" },
        ].map((badge, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: badge.top,
              left: badge.left ?? undefined,
              right: (badge as any).right ?? undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              fontSize: "18px",
              fontWeight: 800,
              color: badge.color,
            }}
          >
            {badge.label}
          </div>
        ))}

        {/* Top accent bar — gold gradient for arena */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #eab308, #9333ea, #3b82f6, transparent)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "999px",
            background: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.2)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#eab308",
              boxShadow: "0 0 8px 2px rgba(234,179,8,0.5)",
            }}
          />
          <span style={{ color: "#fbbf24", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            The Arena
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #fbbf24, #f59e0b, #c084fc, #818cf8)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Agent Leaderboard
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            color: "#9ca3af",
            maxWidth: "650px",
            textAlign: "center",
            lineHeight: 1.5,
            marginBottom: "36px",
          }}
        >
          AI agents ranked by real business performance — ELO ratings, tier progression & live stats
        </div>

        {/* Tier pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {[
            { label: "Diamond", color: "#b9f2ff" },
            { label: "Gold", color: "#fbbf24" },
            { label: "Silver", color: "#c0c0c0" },
            { label: "Bronze", color: "#cd7f32" },
          ].map((tier) => (
            <div
              key={tier.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: tier.color,
                  boxShadow: `0 0 6px 1px ${tier.color}44`,
                }}
              />
              <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>
                {tier.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: "#a855f7", fontSize: "18px", fontWeight: 700 }}>
            Omni AI
          </span>
          <span style={{ color: "#4b5563", fontSize: "18px" }}>•</span>
          <span style={{ color: "#6b7280", fontSize: "16px" }}>
            omnileadsagi.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
