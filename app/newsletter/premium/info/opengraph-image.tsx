import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Interlinked Premium is free for a limited time";
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
        {/* Premium diamond shapes — rendered as rotated-looking squares using borders (no transform) */}
        {/* Diamond shapes approximated as small squares with visible borders */}
        <div style={{ position: "absolute", top: "100px", left: "150px", width: "42px", height: "42px", borderRadius: "4px", display: "flex", border: "1px solid rgba(234,179,8,0.06)", background: "rgba(234,179,8,0.02)" }} />
        <div style={{ position: "absolute", top: "80px", left: "970px", width: "35px", height: "35px", borderRadius: "4px", display: "flex", border: "1px solid rgba(234,179,8,0.07)", background: "rgba(234,179,8,0.025)" }} />
        <div style={{ position: "absolute", top: "350px", left: "120px", width: "32px", height: "32px", borderRadius: "4px", display: "flex", border: "1px solid rgba(234,179,8,0.08)", background: "rgba(234,179,8,0.03)" }} />
        <div style={{ position: "absolute", top: "380px", left: "1010px", width: "39px", height: "39px", borderRadius: "4px", display: "flex", border: "1px solid rgba(234,179,8,0.09)", background: "rgba(234,179,8,0.035)" }} />
        <div style={{ position: "absolute", top: "200px", left: "80px", width: "25px", height: "25px", borderRadius: "4px", display: "flex", border: "1px solid rgba(234,179,8,0.1)", background: "rgba(234,179,8,0.04)" }} />
        <div style={{ position: "absolute", top: "250px", left: "1060px", width: "28px", height: "28px", borderRadius: "4px", display: "flex", border: "1px solid rgba(234,179,8,0.11)", background: "rgba(234,179,8,0.045)" }} />

        {/* Gold glow */}
        <div style={{ position: "absolute", top: "80px", left: "350px", width: "500px", height: "400px", borderRadius: "250px", display: "flex", background: "radial-gradient(circle, rgba(234,179,8,0.06) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", top: "150px", left: "200px", width: "300px", height: "300px", borderRadius: "150px", display: "flex", background: "radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)" }} />

        {/* Top accent — gold */}
        <div style={{ position: "absolute", top: "0px", left: "0px", width: "1200px", height: "4px", display: "flex", background: "linear-gradient(90deg, transparent, #eab308, #f59e0b, #9333ea, transparent)" }} />
        {/* Bottom accent */}
        <div style={{ position: "absolute", top: "628px", left: "0px", width: "1200px", height: "2px", display: "flex", background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)" }} />

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
          <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#eab308", display: "flex" }} />
          <span style={{ color: "#fbbf24", fontSize: "16px", fontWeight: 600, letterSpacing: "2px" }}>
            PREMIUM
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
          Interlinked Premium
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
          Free premium access for a limited time
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#eab308", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Current Intelligence</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Playbooks</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>3x Weekly</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Clear Recommendations</span>
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
