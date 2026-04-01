import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — Website Development & Managed Hosting Service";
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
          background: "linear-gradient(135deg, #050505 0%, #0a1a14 40%, #051510 70%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow effects */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "200px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
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
            background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent, #10b981, #06b6d4, transparent)",
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
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
            }}
          />
          <span style={{ color: "#6ee7b7", fontSize: "18px", fontWeight: 600 }}>
            Website Service
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "64px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #6ee7b7, #5eead4, #a7f3d0)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Website Development
        </div>

        {/* Subtitle */}
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
          AI-managed hosting, monitoring & scaling — zero micromanagement required.
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["Custom Dev", "24/7 Monitoring", "Auto-Scaling", "Security"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
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
                    background: "#10b981",
                  }}
                />
                <span style={{ color: "#d1d5db", fontSize: "16px", fontWeight: 500 }}>
                  {label}
                </span>
              </div>
            )
          )}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: "#6ee7b7", fontSize: "20px", fontWeight: 700 }}>
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
