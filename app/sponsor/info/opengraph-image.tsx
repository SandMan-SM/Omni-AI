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
        {/* Investment growth curve — abstract rising line */}
        <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", height: "200px" }}>
          <div style={{ position: "absolute", bottom: "0", left: "80px", width: "100%", height: "2px", background: "linear-gradient(90deg, rgba(34,197,94,0.3), rgba(147,51,234,0.2), transparent)", transform: "rotate(-8deg)", transformOrigin: "left bottom" }} />
          <div style={{ position: "absolute", bottom: "40px", left: "200px", width: "80%", height: "1px", background: "linear-gradient(90deg, rgba(34,197,94,0.2), rgba(99,102,241,0.15), transparent)", transform: "rotate(-12deg)", transformOrigin: "left bottom" }} />
        </div>

        {/* Dollar sign accents */}
        {[
          { top: "100px", left: "130px", size: "36px", opacity: 0.06 },
          { top: "160px", right: "160px", size: "28px", opacity: 0.05 },
          { top: "380px", left: "200px", size: "24px", opacity: 0.04 },
          { top: "320px", right: "220px", size: "32px", opacity: 0.05 },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left ?? undefined,
              right: (s as any).right ?? undefined,
              fontSize: s.size,
              fontWeight: 800,
              color: `rgba(34,197,94,${s.opacity * 4})`,
            }}
          >
            $
          </div>
        ))}

        {/* Glows */}
        <div style={{ position: "absolute", top: "50px", left: "200px", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "50px", right: "200px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(147,51,234,0.1) 0%, transparent 70%)" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, transparent, #22c55e, #9333ea, transparent)" }} />

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
            Sponsorship
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
          {["Lead Gen", "24/7 Engagement", "Marketing", "Analytics"].map((label, i) => (
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
