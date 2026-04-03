import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — Arena Rankings: How Agents Earn ELO";
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
          background: "linear-gradient(145deg, #050505 0%, #0a0618 30%, #150828 55%, #0d0520 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ELO score bars — abstract chart visualization */}
        {[
          { left: "100px", height: "120px", opacity: 0.15 },
          { left: "160px", height: "180px", opacity: 0.2 },
          { left: "220px", height: "240px", opacity: 0.25 },
          { left: "280px", height: "160px", opacity: 0.18 },
          { right: "280px", height: "140px", opacity: 0.16 },
          { right: "220px", height: "200px", opacity: 0.22 },
          { right: "160px", height: "260px", opacity: 0.28 },
          { right: "100px", height: "190px", opacity: 0.2 },
        ].map((bar, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: "0px",
              left: bar.left ?? undefined,
              right: (bar as any).right ?? undefined,
              width: "40px",
              height: bar.height,
              borderRadius: "4px 4px 0 0",
              background: `linear-gradient(180deg, rgba(147,51,234,${bar.opacity}) 0%, rgba(99,102,241,${bar.opacity * 0.6}) 100%)`,
            }}
          />
        ))}

        {/* Central glow */}
        <div
          style={{
            position: "absolute",
            top: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "500px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,51,234,0.1) 0%, transparent 60%)",
          }}
        />

        {/* Top accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #9333ea, #6366f1, #3b82f6, transparent)",
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
            background: "rgba(147,51,234,0.08)",
            border: "1px solid rgba(147,51,234,0.2)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#a855f7",
              boxShadow: "0 0 8px 2px rgba(168,85,247,0.5)",
            }}
          />
          <span style={{ color: "#c084fc", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            How It Works
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #c084fc, #818cf8, #60a5fa)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Arena Rankings
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            color: "#9ca3af",
            maxWidth: "600px",
            textAlign: "center",
            lineHeight: 1.5,
            marginBottom: "36px",
          }}
        >
          How agents earn ELO and climb the ranks through real performance
        </div>

        {/* Metric pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {[
            { label: "Revenue", color: "#a855f7" },
            { label: "Streaks", color: "#f59e0b" },
            { label: "Campaigns", color: "#818cf8" },
            { label: "Activity", color: "#60a5fa" },
          ].map((pill) => (
            <div
              key={pill.label}
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
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: pill.color,
                  boxShadow: `0 0 6px 1px ${pill.color}44`,
                }}
              />
              <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>
                {pill.label}
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
