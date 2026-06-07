"use client";

import { useId } from "react";

// AtomOrb — glowing atomic nucleus suspended inside a glass sphere
// with three orbital rings, traveling electrons, and a warm core.
// Visual metaphor for the Omni AI "control tower" idea: one center
// (the core) with many systems orbiting it. Used as the hero element
// on /system and as a smaller accent on /manifesto.
//
// Implementation is pure SVG + CSS — no canvas, no JS per-frame, no
// 3D library. The 3D feel comes from three ellipses rotated on
// different axes plus per-electron animateMotion along each path.
// Respects prefers-reduced-motion via the `motion` prop default.

interface AtomOrbProps {
  /** Pixel diameter of the orb. Defaults to 360. */
  size?: number;
  /** Compact mode strips the glass sphere chrome — useful when
   *  embedding inline in a section header at smaller sizes. */
  compact?: boolean;
  /** Color palette — "warm" = orange/amber/rose (the brand-default
   *  variant, matches the chrome-gold sponsor accent). "cool" =
   *  violet/cyan/indigo (matches the reference reflective-orb image
   *  the operator pinned). */
  variant?: "warm" | "cool";
  /** Render a soft mirror reflection underneath the orb — adds the
   *  "sitting on a polished surface" feel from the reference image. */
  reflection?: boolean;
  /** Optional inline class so the parent can position / margin it. */
  className?: string;
}

const PALETTES = {
  warm: {
    ringStops: [
      { offset: "0%", color: "rgba(255,237,213,0.9)" },
      { offset: "50%", color: "rgba(251,146,60,0.95)" },
      { offset: "100%", color: "rgba(244,63,94,0.6)" },
    ],
    coreStops: [
      { offset: "0%", color: "#fff7ed" },
      { offset: "35%", color: "#fbbf24" },
      { offset: "75%", color: "#f97316" },
      { offset: "100%", color: "rgba(244,63,94,0)" },
    ],
    outerGlow:
      "radial-gradient(closest-side, rgba(251,146,60,0.45), rgba(244,63,94,0.18) 45%, rgba(0,0,0,0) 70%)",
    glassInsetShadow:
      "inset 0 0 60px rgba(56,189,248,0.18), inset 0 0 120px rgba(15,23,42,0.6), 0 30px 60px rgba(0,0,0,0.6)",
    sparkColor: "#fde68a",
    rimGradient:
      "conic-gradient(from 220deg, rgba(255,237,213,0.0), rgba(251,191,36,0.55), rgba(244,63,94,0.45), rgba(255,237,213,0.0))",
  },
  cool: {
    // Violet → cyan → magenta. Matches the reference orb (purple/blue
    // atom with iridescent rim).
    ringStops: [
      { offset: "0%", color: "rgba(224,231,255,0.95)" },
      { offset: "45%", color: "rgba(168,85,247,0.95)" },
      { offset: "100%", color: "rgba(56,189,248,0.7)" },
    ],
    coreStops: [
      { offset: "0%", color: "#f5f3ff" },
      { offset: "30%", color: "#a5b4fc" },
      { offset: "60%", color: "#8b5cf6" },
      { offset: "100%", color: "rgba(99,102,241,0)" },
    ],
    outerGlow:
      "radial-gradient(closest-side, rgba(139,92,246,0.45), rgba(56,189,248,0.22) 45%, rgba(0,0,0,0) 70%)",
    glassInsetShadow:
      "inset 0 0 60px rgba(167,139,250,0.22), inset 0 0 120px rgba(15,23,42,0.6), 0 30px 60px rgba(0,0,0,0.6)",
    sparkColor: "#e0e7ff",
    rimGradient:
      "conic-gradient(from 220deg, rgba(56,189,248,0.0), rgba(139,92,246,0.6), rgba(236,72,153,0.45), rgba(56,189,248,0.0))",
  },
};

export function AtomOrb({
  size = 360,
  compact = false,
  variant = "warm",
  reflection = false,
  className,
}: AtomOrbProps) {
  const palette = PALETTES[variant];
  // Stable IDs so multiple instances on the same page don't clash on
  // gradient + filter references. SVG ID lookups are global per
  // document. React renders this component on the server before
  // hydration; Math.random() here produced different SVG IDs between
  // server HTML and client render, causing production hydration errors.
  const reactId = useId();
  const id = `atom-${reactId.replace(/:/g, "")}`;

  // Total height includes the optional reflection strip below the orb.
  const reflectionHeight = reflection ? Math.round(size * 0.32) : 0;

  // Responsive sizing — clamp the orb's effective width to whichever
  // is smaller: the requested size, or the viewport minus 32px of
  // gutter. The internal SVG uses viewBox so it scales to whatever
  // width the wrapper resolves to. aspect-ratio: 1/1 keeps the orb
  // round even when the width is reduced. Reflection strip below
  // scales by the same proportion.
  const cssSize = `min(${size}px, calc(100vw - 32px))`;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "relative",
        width: cssSize,
        // Total height = orb (square) + reflection strip (32% of orb size).
        // Express as relative units so it shrinks with the orb.
        aspectRatio: reflection
          ? `${size} / ${size + reflectionHeight}`
          : "1 / 1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {/* The orb itself — square, 100% of wrapper width if no
          reflection, or the orb-portion if reflection is on. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Outer ambient glow — sits BEHIND the glass sphere so the
            color light reads as bleeding past the orb's edge. */}
        <div
          style={{
            position: "absolute",
            inset: "-15%",
            borderRadius: "50%",
            background: palette.outerGlow,
            filter: "blur(28px)",
            pointerEvents: "none",
          }}
        />

        {/* Iridescent rim — a slowly rotating conic gradient sliced
            into a thin ring via mask. Matches the prismatic edge in
            the reference orb. Hidden in compact mode. */}
        {!compact && (
          <div
            style={{
              position: "absolute",
              inset: "-2%",
              borderRadius: "50%",
              background: palette.rimGradient,
              WebkitMask:
                "radial-gradient(circle, transparent 47%, black 49%, black 50%, transparent 52%)",
              mask: "radial-gradient(circle, transparent 47%, black 49%, black 50%, transparent 52%)",
              animation: "atom-rim-spin 18s linear infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Glass sphere — three layered radial gradients give it the
            refractive feel: outer rim (cool), inner depth (deep tint),
            and a top-left specular highlight. Compact mode skips this
            and renders the rings + core directly on a transparent
            background. */}
        {!compact && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.18), rgba(255,255,255,0.04) 18%, rgba(8,12,28,0.55) 55%, rgba(2,4,12,0.85) 100%)",
              boxShadow: palette.glassInsetShadow,
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />
        )}

      {/* The atom — SVG with rings + traveling electrons + core. */}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          {/* Ring stroke — three-stop gradient driven by the active
              palette (warm = white→amber→rose, cool = lavender→violet→cyan). */}
          <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
            {palette.ringStops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>

          {/* Core gradient — bright center fading to the palette's
              outer color. */}
          <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
            {palette.coreStops.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </radialGradient>

          {/* Bloom filter for the core + electrons. */}
          <filter id={`${id}-bloom`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Three orbital paths — different tilt axes so they read
              as 3D when stacked. Reused as motion paths for each
              ring's traveling electron. */}
          <path
            id={`${id}-ring1`}
            d="M 100 100 m -78 0 a 78 28 0 1 0 156 0 a 78 28 0 1 0 -156 0"
          />
          <path
            id={`${id}-ring2`}
            d="M 100 100 m -78 0 a 78 28 0 1 0 156 0 a 78 28 0 1 0 -156 0"
          />
          <path
            id={`${id}-ring3`}
            d="M 100 100 m -78 0 a 78 28 0 1 0 156 0 a 78 28 0 1 0 -156 0"
          />
        </defs>

        {/* Three orbital rings, each rotated on a different axis. The
            <use> on the path-shape draws the visible ring; the <circle>
            with animateMotion is the electron traveling along the
            invisible motion path. */}

        {/* Ring 1 — tilted left, slow */}
        <g transform="rotate(20 100 100)">
          <use
            href={`#${id}-ring1`}
            stroke={`url(#${id}-ring)`}
            strokeWidth="0.9"
            fill="none"
            opacity="0.75"
          />
          <circle r="2.4" fill="#fff7ed" filter={`url(#${id}-bloom)`}>
            <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${id}-ring1`} />
            </animateMotion>
          </circle>
        </g>

        {/* Ring 2 — tilted right, faster */}
        <g transform="rotate(-55 100 100)">
          <use
            href={`#${id}-ring2`}
            stroke={`url(#${id}-ring)`}
            strokeWidth="0.9"
            fill="none"
            opacity="0.75"
          />
          <circle r="2.2" fill={palette.sparkColor} filter={`url(#${id}-bloom)`}>
            <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${id}-ring2`} />
            </animateMotion>
          </circle>
        </g>

        {/* Ring 3 — near-vertical, slowest */}
        <g transform="rotate(82 100 100)">
          <use
            href={`#${id}-ring3`}
            stroke={`url(#${id}-ring)`}
            strokeWidth="0.9"
            fill="none"
            opacity="0.75"
          />
          <circle r="2.6" fill="#fdba74" filter={`url(#${id}-bloom)`}>
            <animateMotion dur="8s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${id}-ring3`} />
            </animateMotion>
          </circle>
        </g>

        {/* Soft glow halo around the core */}
        <circle cx="100" cy="100" r="22" fill={`url(#${id}-core)`} opacity="0.35" filter={`url(#${id}-bloom)`} />

        {/* Bright core */}
        <circle
          cx="100"
          cy="100"
          r="8"
          fill={`url(#${id}-core)`}
          filter={`url(#${id}-bloom)`}
        />

        {/* Tiny floating sparks inside the orb — extra detail so
            the composition feels alive when the rings are paused. */}
        <g opacity="0.7">
          <circle cx="62" cy="78" r="0.8" fill={palette.sparkColor}>
            <animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="138" cy="118" r="0.8" fill={palette.sparkColor}>
            <animate attributeName="opacity" values="0.2;1;0.2" dur="4s" begin="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="92" cy="138" r="0.8" fill={palette.sparkColor}>
            <animate attributeName="opacity" values="0.2;1;0.2" dur="3.6s" begin="0.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="118" cy="62" r="0.8" fill={palette.sparkColor}>
            <animate attributeName="opacity" values="0.2;1;0.2" dur="4.2s" begin="2s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

        {/* Top-left specular highlight on the glass — a soft white
            smear at the upper-left quadrant gives the orb its "lit
            from the front-left" feel. Compact mode skips it. */}
        {!compact && (
          <div
            style={{
              position: "absolute",
              top: "8%",
              left: "12%",
              width: "32%",
              height: "32%",
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.35), rgba(255,255,255,0))",
              filter: "blur(8px)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Reflective floor — a fading vertical mirror of the orb cast
          on a polished surface. Pure CSS scaleY(-1) of the same
          glow/rim/highlight, masked to fade out toward the bottom.
          Adds the "sitting on something" depth from the reference. */}
      {reflection && !compact && (
        <div
          style={{
            position: "relative",
            width: size,
            height: reflectionHeight,
            transform: "scaleY(-1)",
            opacity: 0.45,
            WebkitMaskImage:
              "linear-gradient(to top, transparent 0%, black 80%)",
            maskImage: "linear-gradient(to top, transparent 0%, black 80%)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            filter: "blur(1px)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: size,
              height: size * 0.7,
              borderRadius: "50%",
              background: palette.outerGlow,
              filter: "blur(20px)",
            }}
          />
        </div>
      )}

      {/* Keyframes for the rim animation. Scoped via inline <style>
          so the component is self-contained. */}
      <style>{`
        @keyframes atom-rim-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
