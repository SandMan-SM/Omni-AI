import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Omni AI — Upcoming Live AI Strategy Sessions";
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
          background: "linear-gradient(145deg, #050505 0%, #080a18 30%, #0e1028 55%, #0a0820 75%, #050505 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Clock circle — abstract timer (outer) */}
        <div
          style={{
            position: "absolute",
            top: "105px",
            left: "390px",
            width: "420px",
            height: "420px",
            borderRadius: "210px",
            display: "flex",
            border: "1px solid rgba(147,51,234,0.08)",
          }}
        />
        {/* Clock circle — outer ring */}
        <div
          style={{
            position: "absolute",
            top: "75px",
            left: "360px",
            width: "480px",
            height: "480px",
            borderRadius: "240px",
            display: "flex",
            border: "1px solid rgba(147,51,234,0.04)",
          }}
        />

        {/* Tick marks around clock — static dots at 12 positions instead of rotated lines */}
        {/* 12 o'clock (top center) */}
        <div style={{ position: "absolute", top: "85px", left: "598px", width: "4px", height: "12px", display: "flex", background: "rgba(147,51,234,0.2)" }} />
        {/* 3 o'clock (right) */}
        <div style={{ position: "absolute", top: "309px", left: "800px", width: "12px", height: "4px", display: "flex", background: "rgba(147,51,234,0.2)" }} />
        {/* 6 o'clock (bottom) */}
        <div style={{ position: "absolute", top: "525px", left: "598px", width: "4px", height: "12px", display: "flex", background: "rgba(147,51,234,0.2)" }} />
        {/* 9 o'clock (left) */}
        <div style={{ position: "absolute", top: "309px", left: "388px", width: "12px", height: "4px", display: "flex", background: "rgba(147,51,234,0.2)" }} />
        {/* 1 o'clock */}
        <div style={{ position: "absolute", top: "120px", left: "700px", width: "4px", height: "12px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 2 o'clock */}
        <div style={{ position: "absolute", top: "200px", left: "775px", width: "12px", height: "4px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 4 o'clock */}
        <div style={{ position: "absolute", top: "420px", left: "775px", width: "12px", height: "4px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 5 o'clock */}
        <div style={{ position: "absolute", top: "490px", left: "700px", width: "4px", height: "12px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 7 o'clock */}
        <div style={{ position: "absolute", top: "490px", left: "496px", width: "4px", height: "12px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 8 o'clock */}
        <div style={{ position: "absolute", top: "420px", left: "413px", width: "12px", height: "4px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 10 o'clock */}
        <div style={{ position: "absolute", top: "200px", left: "413px", width: "12px", height: "4px", display: "flex", background: "rgba(147,51,234,0.08)" }} />
        {/* 11 o'clock */}
        <div style={{ position: "absolute", top: "120px", left: "496px", width: "4px", height: "12px", display: "flex", background: "rgba(147,51,234,0.08)" }} />

        {/* Pulse glow at center */}
        <div style={{ position: "absolute", top: "215px", left: "500px", width: "200px", height: "200px", borderRadius: "100px", display: "flex", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)" }} />

        {/* Calendar accent dots */}
        <div style={{ position: "absolute", top: "100px", left: "180px", width: "6px", height: "6px", borderRadius: "3px", display: "flex", background: "#3b82f6" }} />
        <div style={{ position: "absolute", top: "130px", left: "994px", width: "6px", height: "6px", borderRadius: "3px", display: "flex", background: "#a855f7" }} />
        <div style={{ position: "absolute", top: "420px", left: "220px", width: "6px", height: "6px", borderRadius: "3px", display: "flex", background: "#3b82f6" }} />
        <div style={{ position: "absolute", top: "400px", left: "954px", width: "6px", height: "6px", borderRadius: "3px", display: "flex", background: "#a855f7" }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: "0px", left: "0px", width: "1200px", height: "4px", display: "flex", background: "linear-gradient(90deg, transparent, #3b82f6, #9333ea, transparent)" }} />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "999px",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            marginBottom: "20px",
          }}
        >
          <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: "#3b82f6", display: "flex" }} />
          <span style={{ color: "#60a5fa", fontSize: "16px", fontWeight: 600, letterSpacing: "2px" }}>
            LIVE SESSIONS
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #60a5fa, #818cf8, #c084fc)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Upcoming Sessions
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
          Join our next live AI strategy session — webinars, demos & Q&A
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#3b82f6", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Webinars</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#a855f7", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Live Demo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#818cf8", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Q&A</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#60a5fa", display: "flex" }} />
            <span style={{ color: "#d1d5db", fontSize: "15px", fontWeight: 500 }}>Strategy</span>
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
