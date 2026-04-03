import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI Newsletter — Daily AI Strategy & Intelligence";
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
          background: "linear-gradient(145deg, #050505 0%, #0a0818 30%, #120828 55%, #0d0520 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Newsletter/envelope abstract — stacked cards (no rotation, slight offsets) */}
        <div
          style={{
            position: "absolute",
            top: "450px",
            left: "340px",
            width: "500px",
            height: "120px",
            borderRadius: "12px",
            display: "flex",
            border: "1px solid rgba(147,51,234,0.06)",
            background: "rgba(147,51,234,0.018)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "460px",
            left: "355px",
            width: "500px",
            height: "120px",
            borderRadius: "12px",
            display: "flex",
            border: "1px solid rgba(147,51,234,0.08)",
            background: "rgba(147,51,234,0.024)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "470px",
            left: "350px",
            width: "500px",
            height: "120px",
            borderRadius: "12px",
            display: "flex",
            border: "1px solid rgba(147,51,234,0.1)",
            background: "rgba(147,51,234,0.03)",
          }}
        />

        {/* Signal lines — broadcasting (horizontal, no rotation) */}
        <div style={{ position: "absolute", top: "100px", left: "140px", width: "200px", height: "1px", display: "flex", background: "linear-gradient(90deg, transparent, rgba(147,51,234,0.2), transparent)" }} />
        <div style={{ position: "absolute", top: "140px", left: "870px", width: "180px", height: "1px", display: "flex", background: "linear-gradient(90deg, transparent, rgba(147,51,234,0.2), transparent)" }} />
        <div style={{ position: "absolute", top: "400px", left: "180px", width: "160px", height: "1px", display: "flex", background: "linear-gradient(90deg, transparent, rgba(147,51,234,0.2), transparent)" }} />
        <div style={{ position: "absolute", top: "380px", left: "840px", width: "190px", height: "1px", display: "flex", background: "linear-gradient(90deg, transparent, rgba(147,51,234,0.2), transparent)" }} />

        {/* Glows */}
        <div style={{ position: "absolute", top: "60px", left: "250px", width: "350px", height: "350px", borderRadius: "175px", display: "flex", background: "radial-gradient(circle, rgba(147,51,234,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "270px", left: "670px", width: "280px", height: "280px", borderRadius: "140px", display: "flex", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: "0px", left: "0px", width: "1200px", height: "4px", display: "flex", background: "linear-gradient(90deg, transparent, #9333ea, #6366f1, #3b82f6, transparent)" }} />

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
          <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#a855f7", display: "flex" }} />
          <span style={{ color: "#c084fc", fontSize: "16px", fontWeight: 600, letterSpacing: "2px" }}>
            NEWSLETTER
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "68px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #c084fc, #818cf8, #60a5fa)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Omni AI Newsletter
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
          Stories, strategies, and signals that matter — delivered daily at 8 AM
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Daily Briefs</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>AI Strategy</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Free + Premium</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#6366f1", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Intelligence</span>
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
