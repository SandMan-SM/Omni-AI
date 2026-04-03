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
        {/* Newsletter/envelope abstract — stacked cards */}
        {[
          { bottom: "60px", rotation: "-3deg", opacity: 0.06 },
          { bottom: "50px", rotation: "2deg", opacity: 0.08 },
          { bottom: "40px", rotation: "-1deg", opacity: 0.1 },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: card.bottom,
              left: "50%",
              transform: `translateX(-50%) rotate(${card.rotation})`,
              width: "500px",
              height: "120px",
              borderRadius: "12px",
              border: `1px solid rgba(147,51,234,${card.opacity})`,
              background: `rgba(147,51,234,${card.opacity * 0.3})`,
            }}
          />
        ))}

        {/* Signal lines — broadcasting */}
        {[
          { top: "100px", left: "140px", width: "200px", deg: "15deg" },
          { top: "140px", right: "150px", width: "180px", deg: "-10deg" },
          { top: "400px", left: "180px", width: "160px", deg: "-8deg" },
          { top: "380px", right: "170px", width: "190px", deg: "12deg" },
        ].map((line, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: line.top,
              left: line.left ?? undefined,
              right: (line as any).right ?? undefined,
              width: line.width,
              height: "1px",
              background: `linear-gradient(90deg, transparent, rgba(147,51,234,0.2), transparent)`,
              transform: `rotate(${line.deg})`,
            }}
          />
        ))}

        {/* Glows */}
        <div style={{ position: "absolute", top: "60px", left: "250px", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(147,51,234,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "80px", right: "250px", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, transparent, #9333ea, #6366f1, #3b82f6, transparent)" }} />

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
            Newsletter
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
          {["Daily Briefs", "AI Strategy", "Free + Premium", "Intelligence"].map((label, i) => (
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
