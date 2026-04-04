import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — Become a Sponsor: AI-Powered Lead Generation";
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
          background: "linear-gradient(145deg, #050505 0%, #0a0818 30%, #14082a 55%, #0d0520 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Investment growth lines — horizontal, no rotation */}
        <div style={{ position: "absolute", top: "430px", left: "0px", width: "1200px", height: "200px", display: "flex" }}>
          <div style={{ position: "absolute", top: "160px", left: "80px", width: "1000px", height: "2px", display: "flex", background: "linear-gradient(90deg, rgba(34,197,94,0.3), rgba(147,51,234,0.2), transparent)" }} />
          <div style={{ position: "absolute", top: "120px", left: "200px", width: "800px", height: "1px", display: "flex", background: "linear-gradient(90deg, rgba(34,197,94,0.2), rgba(99,102,241,0.15), transparent)" }} />
        </div>

        {/* Dollar sign accents — explicit inline */}
        <div style={{ position: "absolute", top: "100px", left: "130px", fontSize: "36px", fontWeight: 800, color: "rgba(34,197,94,0.24)", display: "flex" }}>$</div>
        <div style={{ position: "absolute", top: "160px", left: "880px", fontSize: "28px", fontWeight: 800, color: "rgba(34,197,94,0.2)", display: "flex" }}>$</div>
        <div style={{ position: "absolute", top: "380px", left: "200px", fontSize: "24px", fontWeight: 800, color: "rgba(34,197,94,0.16)", display: "flex" }}>$</div>
        <div style={{ position: "absolute", top: "320px", left: "948px", fontSize: "32px", fontWeight: 800, color: "rgba(34,197,94,0.2)", display: "flex" }}>$</div>

        {/* Glows */}
        <div style={{ position: "absolute", top: "50px", left: "200px", width: "350px", height: "350px", borderRadius: "175px", display: "flex", background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "280px", left: "700px", width: "300px", height: "300px", borderRadius: "150px", display: "flex", background: "radial-gradient(circle, rgba(147,51,234,0.1) 0%, transparent 70%)" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: "0px", left: "0px", width: "1200px", height: "4px", display: "flex", background: "linear-gradient(90deg, transparent, #22c55e, #9333ea, transparent)" }} />

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
            SPONSORSHIP
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
          Become a Sponsor
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
          Invest in AI-powered lead generation & automation for your business
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#22c55e", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Lead Gen</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>24/7 Engagement</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Marketing</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Analytics</span>
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
