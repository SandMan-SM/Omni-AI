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
        {/* ELO score bars — left side */}
        <div style={{ position: "absolute", top: "510px", left: "100px", width: "40px", height: "120px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.15) 0%, rgba(99,102,241,0.09) 100%)" }} />
        <div style={{ position: "absolute", top: "450px", left: "160px", width: "40px", height: "180px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.2) 0%, rgba(99,102,241,0.12) 100%)" }} />
        <div style={{ position: "absolute", top: "390px", left: "220px", width: "40px", height: "240px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.25) 0%, rgba(99,102,241,0.15) 100%)" }} />
        <div style={{ position: "absolute", top: "470px", left: "280px", width: "40px", height: "160px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.18) 0%, rgba(99,102,241,0.108) 100%)" }} />
        {/* ELO score bars — right side */}
        <div style={{ position: "absolute", top: "490px", left: "880px", width: "40px", height: "140px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.16) 0%, rgba(99,102,241,0.096) 100%)" }} />
        <div style={{ position: "absolute", top: "430px", left: "940px", width: "40px", height: "200px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.22) 0%, rgba(99,102,241,0.132) 100%)" }} />
        <div style={{ position: "absolute", top: "370px", left: "1000px", width: "40px", height: "260px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.28) 0%, rgba(99,102,241,0.168) 100%)" }} />
        <div style={{ position: "absolute", top: "440px", left: "1060px", width: "40px", height: "190px", borderRadius: "4px 4px 0 0", display: "flex", background: "linear-gradient(180deg, rgba(147,51,234,0.2) 0%, rgba(99,102,241,0.12) 100%)" }} />

        {/* Central glow */}
        <div
          style={{
            position: "absolute",
            top: "100px",
            left: "350px",
            width: "500px",
            height: "400px",
            borderRadius: "250px",
            display: "flex",
            background: "radial-gradient(circle, rgba(147,51,234,0.1) 0%, transparent 60%)",
          }}
        />

        {/* Top accent */}
        <div
          style={{
            position: "absolute",
            top: "0px",
            left: "0px",
            width: "1200px",
            height: "4px",
            display: "flex",
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
              borderRadius: "4px",
              background: "#a855f7",
              display: "flex",
            }}
          />
          <span style={{ color: "#c084fc", fontSize: "16px", fontWeight: 600, letterSpacing: "2px" }}>
            HOW IT WORKS
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Revenue</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#f59e0b", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Streaks</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Campaigns</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Activity</span>
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            top: "574px",
            left: "0px",
            width: "1200px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
