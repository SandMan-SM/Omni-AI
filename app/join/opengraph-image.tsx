import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Join Omni AI — Start Automating Your Business";
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
          background: "linear-gradient(145deg, #050505 0%, #08061a 30%, #10082e 55%, #0d0520 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Welcome gate — large arch glow */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "500px",
            height: "500px",
            borderRadius: "250px 250px 0 0",
            background: "radial-gradient(ellipse at top, rgba(147,51,234,0.1) 0%, transparent 60%)",
          }}
        />

        {/* Side accent lines */}
        <div style={{ position: "absolute", top: "120px", left: "100px", width: "1px", height: "400px", background: "linear-gradient(180deg, transparent, rgba(147,51,234,0.2), transparent)" }} />
        <div style={{ position: "absolute", top: "120px", right: "100px", width: "1px", height: "400px", background: "linear-gradient(180deg, transparent, rgba(59,130,246,0.2), transparent)" }} />

        {/* Scattered dots — onboarding steps */}
        {[
          { top: "160px", left: "200px", size: "10px", color: "rgba(168,85,247,0.4)" },
          { top: "220px", left: "300px", size: "8px", color: "rgba(129,140,248,0.35)" },
          { top: "180px", right: "250px", size: "10px", color: "rgba(96,165,250,0.4)" },
          { top: "240px", right: "320px", size: "7px", color: "rgba(168,85,247,0.3)" },
        ].map((dot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: dot.top,
              left: dot.left ?? undefined,
              right: (dot as any).right ?? undefined,
              width: dot.size,
              height: dot.size,
              borderRadius: "50%",
              background: dot.color,
              boxShadow: `0 0 12px 3px ${dot.color}`,
            }}
          />
        ))}

        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, transparent, #22c55e, #9333ea, #3b82f6, transparent)" }} />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "999px",
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            marginBottom: "20px",
          }}
        >
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px 2px rgba(34,197,94,0.5)" }} />
          <span style={{ color: "#4ade80", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            Get Started
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #4ade80, #c084fc, #818cf8)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Join Omni AI
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
          Start automating your business with AI agents — free to get started
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["Free Signup", "AI Agents", "Lead Gen", "Automation"].map((label, i) => (
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
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ["#22c55e", "#a855f7", "#818cf8", "#60a5fa"][i] }} />
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
