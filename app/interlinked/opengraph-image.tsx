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
          background: "linear-gradient(135deg, #030308 0%, #0a0318 30%, #120428 55%, #0d0220 75%, #030308 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Network node glow top-left */}
        <div style={{ position: "absolute", top: "60px", left: "100px", width: "200px", height: "200px", borderRadius: "100px", background: "radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 70%)", display: "flex" }} />
        {/* Network node glow bottom-left */}
        <div style={{ position: "absolute", top: "320px", left: "60px", width: "160px", height: "160px", borderRadius: "80px", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", display: "flex" }} />
        {/* Network node glow top-right */}
        <div style={{ position: "absolute", top: "100px", left: "900px", width: "220px", height: "220px", borderRadius: "110px", background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)", display: "flex" }} />
        {/* Network node glow bottom-right */}
        <div style={{ position: "absolute", top: "380px", left: "820px", width: "140px", height: "140px", borderRadius: "70px", background: "radial-gradient(circle, rgba(147,51,234,0.14) 0%, transparent 70%)", display: "flex" }} />
        {/* Network node glow center-top */}
        <div style={{ position: "absolute", top: "30px", left: "480px", width: "180px", height: "180px", borderRadius: "90px", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", display: "flex" }} />
        {/* Network node glow center-bottom */}
        <div style={{ position: "absolute", top: "340px", left: "380px", width: "120px", height: "120px", borderRadius: "60px", background: "radial-gradient(circle, rgba(79,70,229,0.16) 0%, transparent 70%)", display: "flex" }} />

        {/* Connection lines */}
        <div style={{ position: "absolute", top: "170px", left: "160px", width: "320px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)", display: "flex" }} />
        <div style={{ position: "absolute", top: "280px", left: "650px", width: "380px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)", display: "flex" }} />
        <div style={{ position: "absolute", top: "400px", left: "230px", width: "300px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent)", display: "flex" }} />
        <div style={{ position: "absolute", top: "140px", left: "580px", width: "280px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.22), transparent)", display: "flex" }} />
        {/* Vertical lines */}
        <div style={{ position: "absolute", top: "100px", left: "300px", width: "2px", height: "180px", background: "linear-gradient(180deg, transparent, rgba(168,85,247,0.2), transparent)", display: "flex" }} />
        <div style={{ position: "absolute", top: "200px", left: "850px", width: "2px", height: "200px", background: "linear-gradient(180deg, transparent, rgba(59,130,246,0.15), transparent)", display: "flex" }} />

        {/* Small node dots */}
        <div style={{ position: "absolute", top: "150px", left: "160px", width: "8px", height: "8px", borderRadius: "4px", background: "#a855f7", display: "flex" }} />
        <div style={{ position: "absolute", top: "200px", left: "380px", width: "8px", height: "8px", borderRadius: "4px", background: "#818cf8", display: "flex" }} />
        <div style={{ position: "absolute", top: "350px", left: "130px", width: "8px", height: "8px", borderRadius: "4px", background: "#a855f7", display: "flex" }} />
        <div style={{ position: "absolute", top: "280px", left: "1020px", width: "8px", height: "8px", borderRadius: "4px", background: "#818cf8", display: "flex" }} />
        <div style={{ position: "absolute", top: "420px", left: "940px", width: "8px", height: "8px", borderRadius: "4px", background: "#a855f7", display: "flex" }} />
        <div style={{ position: "absolute", top: "120px", left: "580px", width: "8px", height: "8px", borderRadius: "4px", background: "#818cf8", display: "flex" }} />
        <div style={{ position: "absolute", top: "380px", left: "450px", width: "8px", height: "8px", borderRadius: "4px", background: "#a855f7", display: "flex" }} />
        <div style={{ position: "absolute", top: "180px", left: "890px", width: "8px", height: "8px", borderRadius: "4px", background: "#818cf8", display: "flex" }} />

        {/* Top accent bar */}
        <div style={{ position: "absolute", top: "0", left: "0", width: "1200px", height: "4px", background: "linear-gradient(90deg, transparent, #9333ea, #6366f1, #3b82f6, transparent)", display: "flex" }} />

        {/* Bottom accent bar */}
        <div style={{ position: "absolute", top: "628px", left: "0", width: "1200px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)", display: "flex" }} />

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
            OMNI AI INTRODUCING
          </span>
        </div>

        {/* Title */}
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

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.15)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Lead Gen</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.15)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Automation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.15)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Scaling</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.15)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#6366f1", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Intelligence</span>
          </div>
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
          <span style={{ color: "#a855f7", fontSize: "18px", fontWeight: 700 }}>Omni AI</span>
          <span style={{ color: "#4b5563", fontSize: "18px" }}>•</span>
          <span style={{ color: "#6b7280", fontSize: "16px" }}>omnileadsagi.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
