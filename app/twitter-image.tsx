import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Omni AI — Autonomous Lead Generation & AI Business Automation";
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
          background: "linear-gradient(145deg, #050505 0%, #0a0520 30%, #12082e 50%, #0a0418 70%, #050505 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Top gradient bar */}
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            height: "4px",
            display: "flex",
            background: "linear-gradient(90deg, transparent, #9333ea, #06b6d4, #22c55e, transparent)",
          }}
        />

        {/* Central glow */}
        <div
          style={{
            position: "absolute",
            top: "150px",
            left: "250px",
            width: "700px",
            height: "350px",
            borderRadius: "350px",
            display: "flex",
            background: "radial-gradient(ellipse at center, rgba(147,51,234,0.15) 0%, rgba(6,182,212,0.06) 40%, transparent 70%)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: "999px",
            background: "rgba(147,51,234,0.1)",
            border: "1px solid rgba(147,51,234,0.3)",
            marginBottom: "32px",
          }}
        >
          <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#a855f7", marginRight: "10px", display: "flex" }} />
          <span style={{ color: "#c084fc", fontSize: "15px", fontWeight: 700, letterSpacing: "3px" }}>
            AUTONOMOUS AI PLATFORM
          </span>
        </div>

        {/* Main Title */}
        <div style={{ display: "flex", fontSize: "76px", fontWeight: 800, letterSpacing: "-2px", color: "#a855f7", lineHeight: 1.1, marginBottom: "8px" }}>
          Omni AI
        </div>

        {/* Subtitle */}
        <div style={{ display: "flex", fontSize: "36px", fontWeight: 600, color: "#e5e7eb", letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: "20px" }}>
          Lead Generation on Autopilot
        </div>

        {/* Description */}
        <div style={{ display: "flex", fontSize: "18px", color: "#9ca3af", maxWidth: "640px", textAlign: "center", lineHeight: 1.6, marginBottom: "44px" }}>
          AI agents that find prospects, run campaigns, qualify leads, and scale your revenue — running 24/7
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", marginRight: "8px", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}>Lead Generation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", marginRight: "8px", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}>AI Campaigns</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#06b6d4", marginRight: "8px", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}>Smart Qualification</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#22c55e", marginRight: "8px", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}>Revenue Scaling</span>
          </div>
        </div>

        {/* Bottom branding */}
        <div style={{ position: "absolute", bottom: "22px", display: "flex", alignItems: "center" }}>
          <span style={{ color: "#a855f7", fontSize: "17px", fontWeight: 700 }}>omnileadsagi.com</span>
          <span style={{ color: "#374151", fontSize: "17px", marginLeft: "10px", marginRight: "10px" }}>—</span>
          <span style={{ color: "#6b7280", fontSize: "15px" }}>The future of lead generation</span>
        </div>

        {/* Bottom bar */}
        <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", height: "2px", display: "flex", background: "linear-gradient(90deg, transparent, rgba(147,51,234,0.4), transparent)" }} />
      </div>
    ),
    { ...size },
  );
}
