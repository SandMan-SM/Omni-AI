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
            left: "350px",
            width: "500px",
            height: "500px",
            borderRadius: "250px 250px 0 0",
            display: "flex",
            background: "radial-gradient(ellipse at top, rgba(147,51,234,0.1) 0%, transparent 60%)",
          }}
        />

        {/* Side accent lines */}
        <div style={{ position: "absolute", top: "120px", left: "100px", width: "1px", height: "400px", display: "flex", background: "linear-gradient(180deg, transparent, rgba(147,51,234,0.2), transparent)" }} />
        <div style={{ position: "absolute", top: "120px", left: "1099px", width: "1px", height: "400px", display: "flex", background: "linear-gradient(180deg, transparent, rgba(59,130,246,0.2), transparent)" }} />

        {/* Scattered dots — onboarding steps */}
        <div style={{ position: "absolute", top: "160px", left: "200px", width: "10px", height: "10px", borderRadius: "5px", display: "flex", background: "rgba(168,85,247,0.4)" }} />
        <div style={{ position: "absolute", top: "220px", left: "300px", width: "8px", height: "8px", borderRadius: "4px", display: "flex", background: "rgba(129,140,248,0.35)" }} />
        <div style={{ position: "absolute", top: "180px", left: "940px", width: "10px", height: "10px", borderRadius: "5px", display: "flex", background: "rgba(96,165,250,0.4)" }} />
        <div style={{ position: "absolute", top: "240px", left: "873px", width: "7px", height: "7px", borderRadius: "4px", display: "flex", background: "rgba(168,85,247,0.3)" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: "0px", left: "0px", width: "1200px", height: "4px", display: "flex", background: "linear-gradient(90deg, transparent, #22c55e, #9333ea, #3b82f6, transparent)" }} />

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
          <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#22c55e", display: "flex" }} />
          <span style={{ color: "#4ade80", fontSize: "16px", fontWeight: 600, letterSpacing: "2px" }}>
            GET STARTED
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#22c55e", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Free Signup</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>AI Agents</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Lead Gen</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Automation</span>
          </div>
        </div>

        {/* Bottom branding */}
        <div style={{ position: "absolute", top: "574px", left: "0px", width: "1200px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ color: "#a855f7", fontSize: "18px", fontWeight: 700 }}>Omni AI</span>
          <span style={{ color: "#4b5563", fontSize: "18px" }}>•</span>
          <span style={{ color: "#6b7280", fontSize: "16px" }}>omnileadsagi.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
