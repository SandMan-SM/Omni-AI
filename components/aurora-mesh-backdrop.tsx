"use client";

// AuroraMeshBackdrop — slow-shifting gradient mesh of soft color blobs
// that drift behind the page like a quiet aurora. Pure CSS animations
// (no canvas, no JS per-frame), so the cost is whatever the GPU spends
// compositing four blurred divs. Premium ambient feel without the
// jitter that a particle system can add to read-heavy pages.
//
// Used on /system to layer behind the chrome-gold sparks. Together
// they read as motion + color depth without competing.

import { useReducedMotion } from "framer-motion";

export function AuroraMeshBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Top-left amber blob */}
      <div
        style={{
          position: "absolute",
          top: "-18%",
          left: "-12%",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(251,191,36,0.32), rgba(251,191,36,0))",
          filter: "blur(32px)",
          animation: reduce
            ? undefined
            : "aurora-drift-a 28s ease-in-out infinite alternate",
        }}
      />

      {/* Center indigo blob */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "30%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(99,102,241,0.22), rgba(99,102,241,0))",
          filter: "blur(40px)",
          animation: reduce
            ? undefined
            : "aurora-drift-b 36s ease-in-out infinite alternate",
        }}
      />

      {/* Bottom-right rose blob */}
      <div
        style={{
          position: "absolute",
          bottom: "-22%",
          right: "-15%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(244,63,94,0.18), rgba(244,63,94,0))",
          filter: "blur(36px)",
          animation: reduce
            ? undefined
            : "aurora-drift-c 32s ease-in-out infinite alternate",
        }}
      />

      {/* Top-right emerald accent blob */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          right: "-10%",
          width: "42vw",
          height: "42vw",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(16,185,129,0.18), rgba(16,185,129,0))",
          filter: "blur(40px)",
          animation: reduce
            ? undefined
            : "aurora-drift-d 40s ease-in-out infinite alternate",
        }}
      />

      {/* Faint dot grid overlay — gives the mesh a subtle “composed”
          texture rather than a pure painting. 1px dots at 32px pitch,
          extremely low opacity so it doesn't compete with content. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(251,191,36,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          mixBlendMode: "screen",
        }}
      />

      {/* Animations are scoped inline via styled-jsx-style template
          literal injected as a global stylesheet. Keeps the keyframes
          colocated with the component without pulling in a CSS module. */}
      <style>{`
        @keyframes aurora-drift-a {
          0%   { transform: translate3d(0, 0, 0)       scale(1); }
          100% { transform: translate3d(8vw, 6vh, 0)   scale(1.08); }
        }
        @keyframes aurora-drift-b {
          0%   { transform: translate3d(0, 0, 0)       scale(1); }
          100% { transform: translate3d(-6vw, -4vh, 0) scale(1.05); }
        }
        @keyframes aurora-drift-c {
          0%   { transform: translate3d(0, 0, 0)       scale(1); }
          100% { transform: translate3d(-7vw, 5vh, 0)  scale(1.07); }
        }
        @keyframes aurora-drift-d {
          0%   { transform: translate3d(0, 0, 0)       scale(1); }
          100% { transform: translate3d(-5vw, 4vh, 0)  scale(1.06); }
        }
      `}</style>
    </div>
  );
}
