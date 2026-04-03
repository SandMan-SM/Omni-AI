import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Interlinked by Omni AI — Autonomous Lead Generation, Operations & Scaling";
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
          background: "linear-gradient(145deg, #030308 0%, #0a0318 30%, #120428 55%, #0d0220 75%, #030308 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Network node glows — scattered across the image */}
        {[
          { top: "80px", left: "120px", size: "180px", color: "rgba(168,85,247,0.22)" },
          { top: "320px", left: "80px", size: "140px", color: "rgba(99,102,241,0.15)" },
          { top: "160px", right: "100px", size: "200px", color: "rgba(59,130,246,0.18)" },
          { top: "400px", right: "180px", size: "120px", color: "rgba(147,51,234,0.14)" },
          { top: "50px", left: "500px", size: "160px", color: "rgba(139,92,246,0.12)" },
          { top: "350px", left: "400px", size: "100px", color: "rgba(79,70,229,0.16)" },
        ].map((node, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: node.top,
              left: node.left ?? undefined,
              right: (node as any).right ?? undefined,
              width: node.size,
              height: node.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${node.color} 0%, transparent 70%)`,
            }}
          />
        ))}

        {/* Connection lines — horizontal and diagonal */}
        <div
          style={{
            position: "absolute",
            top: "180px",
            left: "180px",
            width: "300px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)",
            transform: "rotate(25deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "280px",
            right: "200px",
            width: "350px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)",
            transform: "rotate(-15deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "400px",
            left: "250px",
            width: "280px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent)",
            transform: "rotate(10deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "150px",
            left: "600px",
            width: "250px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.22), transparent)",
            transform: "rotate(35deg)",
          }}
        />

        {/* Small node dots */}
        {[
          { top: "150px", left: "160px" },
          { top: "200px", left: "380px" },
          { top: "350px", left: "130px" },
          { top: "280px", right: "150px" },
          { top: "420px", right: "220px" },
          { top: "120px", left: "580px" },
          { top: "380px", left: "450px" },
          { top: "180px", right: "280px" },
        ].map((dot, i) => (
          <div
            key={`dot-${i}`}
            style={{
              position: "absolute",
              top: dot.top,
              left: dot.left ?? undefined,
              right: (dot as any).right ?? undefined,
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: i % 2 === 0 ? "#a855f7" : "#818cf8",
              boxShadow: `0 0 12px 3px ${i % 2 === 0 ? "rgba(168,85,247,0.5)" : "rgba(129,140,248,0.5)"}`,
            }}
          />
        ))}

        {/* Top accent bar */}
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

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)",
          }}
        />

        {/* Omni AI introducing badge */}
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
              boxShadow: "0 0 8px 2px rgba(168,85,247,0.6)",
            }}
          />
          <span style={{ color: "#c084fc", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            Omni AI introducing
          </span>
        </div>

        {/* INTERLINKED title */}
        <div
          style={{
            display: "flex",
            fontSize: "80px",
            fontWeight: 800,
            letterSpacing: "8px",
            background: "linear-gradient(135deg, #e9d5ff 0%, #c084fc 25%, #818cf8 50%, #60a5fa 75%, #c084fc 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "20px",
            lineHeight: 1,
            textTransform: "uppercase" as const,
          }}
        >
          INTERLINKED
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
            letterSpacing: "0.5px",
          }}
        >
          Autonomous lead generation, operations & scaling — powered by AI agents
        </div>

        {/* Feature row */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["Lead Gen", "Automation", "Scaling", "Intelligence"].map(
            (label, i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "rgba(147,51,234,0.06)",
                  border: "1px solid rgba(147,51,234,0.15)",
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: ["#a855f7", "#818cf8", "#60a5fa", "#6366f1"][i],
                    boxShadow: `0 0 6px 1px ${["rgba(168,85,247,0.5)", "rgba(129,140,248,0.5)", "rgba(96,165,250,0.5)", "rgba(99,102,241,0.5)"][i]}`,
                  }}
                />
                <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>
                  {label}
                </span>
              </div>
            )
          )}
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
