import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Omni AI — Autonomous Lead Generation & AI Business Automation";
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
          background:
            "linear-gradient(145deg, #050505 0%, #0a0520 25%, #12082e 50%, #0a0418 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "630px",
            display: "flex",
            backgroundImage:
              "linear-gradient(rgba(147,51,234,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(147,51,234,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Top gradient bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "4px",
            display: "flex",
            background:
              "linear-gradient(90deg, transparent 5%, #9333ea 30%, #06b6d4 50%, #22c55e 70%, transparent 95%)",
          }}
        />

        {/* Central glow */}
        <div
          style={{
            position: "absolute",
            top: "180px",
            left: "300px",
            width: "600px",
            height: "300px",
            borderRadius: "300px",
            display: "flex",
            background:
              "radial-gradient(ellipse at center, rgba(147,51,234,0.12) 0%, rgba(6,182,212,0.05) 50%, transparent 80%)",
          }}
        />

        {/* Decorative orbital dots */}
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "100px",
            width: "14px",
            height: "14px",
            borderRadius: "7px",
            background: "rgba(147,51,234,0.6)",
            boxShadow: "0 0 20px rgba(147,51,234,0.4)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "160px",
            left: "200px",
            width: "8px",
            height: "8px",
            borderRadius: "4px",
            background: "rgba(168,85,247,0.4)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "120px",
            left: "1040px",
            width: "10px",
            height: "10px",
            borderRadius: "5px",
            background: "rgba(6,182,212,0.5)",
            boxShadow: "0 0 16px rgba(6,182,212,0.3)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "300px",
            left: "1080px",
            width: "6px",
            height: "6px",
            borderRadius: "3px",
            background: "rgba(34,197,94,0.45)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "480px",
            left: "140px",
            width: "9px",
            height: "9px",
            borderRadius: "4.5px",
            background: "rgba(6,182,212,0.35)",
            display: "flex",
          }}
        />

        {/* Connecting lines */}
        <div
          style={{
            position: "absolute",
            top: "87px",
            left: "114px",
            width: "86px",
            height: "1px",
            background:
              "linear-gradient(90deg, rgba(147,51,234,0.3), transparent)",
            display: "flex",
            transform: "rotate(50deg)",
            transformOrigin: "left center",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 24px",
            borderRadius: "999px",
            background: "rgba(147,51,234,0.08)",
            border: "1px solid rgba(147,51,234,0.25)",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "4px",
              background: "#a855f7",
              boxShadow: "0 0 8px rgba(168,85,247,0.6)",
              display: "flex",
            }}
          />
          <span
            style={{
              color: "#c084fc",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Autonomous AI Platform
          </span>
        </div>

        {/* Main Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              fontSize: "72px",
              fontWeight: 800,
              letterSpacing: "-2px",
              background:
                "linear-gradient(135deg, #c084fc 0%, #a855f7 25%, #818cf8 50%, #06b6d4 75%, #22c55e 100%)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.1,
            }}
          >
            Omni AI
          </span>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 600,
              color: "#e5e7eb",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
            }}
          >
            Lead Generation on Autopilot
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: "18px",
            color: "#9ca3af",
            maxWidth: "650px",
            textAlign: "center",
            lineHeight: 1.6,
            marginBottom: "40px",
          }}
        >
          AI agents that find prospects, run campaigns, qualify leads, and scale
          your revenue — running 24/7 without oversight
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { label: "Lead Generation", color: "#a855f7" },
            { label: "AI Campaigns", color: "#818cf8" },
            { label: "Smart Qualification", color: "#06b6d4" },
            { label: "Revenue Scaling", color: "#22c55e" },
          ].map((pill) => (
            <div
              key={pill.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "3px",
                  background: pill.color,
                  boxShadow: `0 0 6px ${pill.color}60`,
                  display: "flex",
                }}
              />
              <span
                style={{ color: "#d1d5db", fontSize: "14px", fontWeight: 500 }}
              >
                {pill.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{ color: "#a855f7", fontSize: "17px", fontWeight: 700 }}
          >
            omnileadsagi.com
          </span>
          <span style={{ color: "#374151", fontSize: "17px" }}>—</span>
          <span style={{ color: "#6b7280", fontSize: "15px" }}>
            The future of lead generation
          </span>
        </div>

        {/* Bottom gradient bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "1200px",
            height: "2px",
            display: "flex",
            background:
              "linear-gradient(90deg, transparent 10%, rgba(147,51,234,0.3) 50%, transparent 90%)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
