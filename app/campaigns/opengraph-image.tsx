import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — AI Video Marketing Campaigns";
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
          background: "linear-gradient(145deg, #050505 0%, #0a0818 30%, #12082e 55%, #0d0520 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Play button triangle — large, centered behind text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "0",
            height: "0",
            borderLeft: "120px solid rgba(147,51,234,0.06)",
            borderTop: "70px solid transparent",
            borderBottom: "70px solid transparent",
          }}
        />

        {/* Video frame lines */}
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "80px",
            width: "160px",
            height: "100px",
            borderRadius: "8px",
            border: "1px solid rgba(147,51,234,0.12)",
            background: "rgba(147,51,234,0.03)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "80px",
            right: "100px",
            width: "140px",
            height: "90px",
            borderRadius: "8px",
            border: "1px solid rgba(99,102,241,0.1)",
            background: "rgba(99,102,241,0.02)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "120px",
            width: "130px",
            height: "85px",
            borderRadius: "8px",
            border: "1px solid rgba(59,130,246,0.1)",
            background: "rgba(59,130,246,0.02)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "100px",
            right: "130px",
            width: "150px",
            height: "95px",
            borderRadius: "8px",
            border: "1px solid rgba(168,85,247,0.1)",
            background: "rgba(168,85,247,0.02)",
          }}
        />

        {/* Glows */}
        <div style={{ position: "absolute", top: "-50px", left: "300px", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(147,51,234,0.14) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-80px", right: "250px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, transparent, #9333ea, #6366f1, transparent)" }} />

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
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 8px 2px rgba(168,85,247,0.5)" }} />
          <span style={{ color: "#c084fc", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            AI Campaigns
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
          AI Video Marketing
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
          AI scripts, produces & optimizes marketing videos tailored to your brand
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["AI Videos", "Auto-Optimization", "Smart Copy", "Performance"].map((label, i) => (
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
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ["#a855f7", "#818cf8", "#60a5fa", "#6366f1"][i] }} />
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
