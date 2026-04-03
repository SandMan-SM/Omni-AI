import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Interlinked Premium — Agentic AI Strategies & Automation Playbooks";
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
        {/* Premium diamond pattern */}
        {[
          { top: "100px", left: "150px", size: "60px" },
          { top: "80px", right: "180px", size: "50px" },
          { top: "350px", left: "120px", size: "45px" },
          { top: "380px", right: "140px", size: "55px" },
          { top: "200px", left: "80px", size: "35px" },
          { top: "250px", right: "100px", size: "40px" },
        ].map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: d.top,
              left: d.left ?? undefined,
              right: (d as any).right ?? undefined,
              width: d.size,
              height: d.size,
              transform: "rotate(45deg)",
              border: `1px solid rgba(234,179,8,${0.06 + i * 0.01})`,
              background: `rgba(234,179,8,${0.02 + i * 0.005})`,
            }}
          />
        ))}

        {/* Gold glow */}
        <div style={{ position: "absolute", top: "80px", left: "50%", transform: "translateX(-50%)", width: "500px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(234,179,8,0.06) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", top: "150px", left: "200px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)" }} />

        {/* Top accent — gold */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, transparent, #eab308, #f59e0b, #9333ea, transparent)" }} />
        {/* Bottom accent */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)" }} />

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
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#eab308", boxShadow: "0 0 8px 2px rgba(234,179,8,0.5)" }} />
          <span style={{ color: "#fbbf24", fontSize: "16px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" as const }}>
            Premium
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
          Agentic AI strategies that compound your advantage — every week
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          {["Mon/Wed/Fri", "Playbooks", "Automation", "Intelligence"].map((label, i) => (
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
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ["#eab308", "#a855f7", "#818cf8", "#60a5fa"][i], boxShadow: `0 0 6px 1px ${["rgba(234,179,8,0.4)", "rgba(168,85,247,0.4)", "rgba(129,140,248,0.4)", "rgba(96,165,250,0.4)"][i]}` }} />
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
