import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — Interlinked: Autonomous Lead Generation & Scaling";
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
          background: "linear-gradient(135deg, #050505 0%, #0d0520 40%, #10052a 70%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "200px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(147,51,234,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "200px",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #9333ea, #3b82f6, transparent)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "999px",
            background: "rgba(147,51,234,0.1)",
            border: "1px solid rgba(147,51,234,0.25)",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#a855f7",
            }}
          />
          <span style={{ color: "#c084fc", fontSize: "18px", fontWeight: 600 }}>
            Interlinked
          </span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "64px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #c084fc, #818cf8, #60a5fa)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Interlinked
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            color: "#9ca3af",
            maxWidth: "700px",
            textAlign: "center",
            lineHeight: 1.4,
            marginBottom: "40px",
          }}
        >
          Autonomous lead generation, operations & scaling
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          {["Lead Gen", "Automation", "Scaling", "Optimization"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#a855f7",
                  }}
                />
                <span style={{ color: "#d1d5db", fontSize: "16px", fontWeight: 500 }}>
                  {label}
                </span>
              </div>
            )
          )}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: "#a855f7", fontSize: "20px", fontWeight: 700 }}>
            Omni AI
          </span>
          <span style={{ color: "#4b5563", fontSize: "20px" }}>•</span>
          <span style={{ color: "#6b7280", fontSize: "18px" }}>
            omnileadsagi.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
