import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — Upcoming Live AI Strategy Sessions";
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
          background: "linear-gradient(145deg, #050505 0%, #080a18 30%, #0e1028 55%, #0a0820 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Clock circle — abstract timer */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            border: "1px solid rgba(147,51,234,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "480px",
            height: "480px",
            borderRadius: "50%",
            border: "1px solid rgba(147,51,234,0.04)",
          }}
        />

        {/* Tick marks around clock */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <div
            key={deg}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "2px",
              height: "12px",
              background: `rgba(147,51,234,${deg % 90 === 0 ? 0.2 : 0.08})`,
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-205px)`,
            }}
          />
        ))}

        {/* Pulse glow at center */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />

        {/* Calendar accent dots */}
        {[
          { top: "100px", left: "180px" },
          { top: "130px", right: "200px" },
          { top: "420px", left: "220px" },
          { top: "400px", right: "240px" },
        ].map((dot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: dot.top,
              left: dot.left ?? undefined,
              right: (dot as any).right ?? undefined,
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: i % 2 === 0 ? "#3b82f6" : "#a855f7",
              boxShadow: `0 0 10px 2px ${i % 2 === 0 ? "rgba(59,130,246,0.4)" : "rgba(168,85,247,0.4)"}`,
            }}
          />
        ))}

        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, transparent, #3b82f6, #9333ea, transparent)" }} />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "999px",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            marginBottom: "20px",
          }}
        >
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 8px 2px rgba(59,130,246,0.5)" }} />
          <span style={{ color: "#60a5fa", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            Live Sessions
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #60a5fa, #818cf8, #c084fc)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Upcoming Sessions
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
          Join our next live AI strategy session — webinars, demos & Q&A
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["Webinars", "Live Demo", "Q&A", "Strategy"].map((label, i) => (
            <div
              key={label}
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
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ["#3b82f6", "#a855f7", "#818cf8", "#60a5fa"][i] }} />
              <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Bottom branding */}
        <div style={{ position: "absolute", bottom: "28px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "#a855f7", fontSize: "18px", fontWeight: 700 }}>Omni AI</span>
          <span style={{ color: "#4b5563", fontSize: "18px" }}>•</span>
          <span style={{ color: "#6b7280", fontSize: "16px" }}>omnileadsagi.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
