"use client";

// OracleBackdrop — cinematic full-viewport background for /oracle.
//
// Design intent: the Oracle page reads as a vision/scripture, so the
// backdrop has to feel like night sky + parchment glow rather than
// a SaaS dashboard. Three layered passes:
//
//   1. Base navy → black radial gradient (deep, contemplative)
//   2. Amber aurora wash + violet counter-wash (palette match: amber-200,
//      violet-400, plus a faint cyan in the deep-bottom for depth)
//   3. ~120 stars hand-distributed via xmur3-style hash so density is
//      uniform (no banding from modulo arithmetic — the failure mode
//      we hit on case-study cosmic backgrounds in a prior round)
//   4. Faint dotted lattice + edge vignette so content stays focal
//
// Pure CSS + a single static <svg> for stars. No canvas, no JS rAF —
// negligible perf cost, respects prefers-reduced-motion automatically
// (animations on aurora blobs disabled by media query).

function hash01(i: number, seed: number): number {
  // Tiny xmur3-shaped integer hash → 0..1 deterministic per (i, seed).
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

const STAR_COUNT = 280;

export function OracleBackdrop() {
  // Pre-compute star positions + sizes so SSR + CSR match. Every 3rd
  // star is flagged `twinkles` so a subset animates opacity — gives the
  // sky genuine motion without cooking the CPU on a full canvas rAF.
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
    const x = hash01(i, 1) * 100;
    const y = hash01(i, 2) * 100;
    const r = 0.5 + hash01(i, 3) * 1.3; // 0.5 – 1.8 px
    const o = 0.4 + hash01(i, 4) * 0.6; // 0.4 – 1.0 — brighter floor
    const twinkles = i % 3 === 0;
    const delay = hash01(i, 5) * 6; // 0 – 6s twinkle phase offset
    return { x, y, r, o, twinkles, delay };
  });

  // z-[1] (positive, above the global SpaceBackdrop in app/layout which
  // sits at -z-10). The page sections render at default z so they stack
  // above this — see also the global selector in <style> below that
  // hides the global SpaceBackdrop while the oracle backdrop is mounted,
  // so the two starfields don't fight for screen space.
  return (
    <div
      aria-hidden
      className="oracle-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* 1. Base — deep navy core, black at the edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #0a0e1f 0%, #06080f 55%, #03050a 100%)",
        }}
      />

      {/* 2a. Amber aurora — top-left */}
      <div
        className="oracle-aurora absolute rounded-full"
        style={{
          top: "-15vh",
          left: "-15vw",
          width: "70vw",
          height: "70vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(252, 211, 77, 0.22) 0%, rgba(252, 211, 77, 0) 60%)",
          filter: "blur(68px)",
          mixBlendMode: "screen",
          animation: "oracle-drift-a 32s ease-in-out infinite alternate",
        }}
      />

      {/* 2b. Violet counter-wash — bottom-right */}
      <div
        className="oracle-aurora absolute rounded-full"
        style={{
          bottom: "-25vh",
          right: "-20vw",
          width: "75vw",
          height: "75vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.18) 0%, rgba(167, 139, 250, 0) 60%)",
          filter: "blur(72px)",
          mixBlendMode: "screen",
          animation: "oracle-drift-b 38s ease-in-out infinite alternate",
        }}
      />

      {/* 2c. Cyan deep — adds depth in the lower-third */}
      <div
        className="oracle-aurora absolute rounded-full"
        style={{
          bottom: "-35vh",
          left: "10vw",
          width: "65vw",
          height: "65vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.10) 0%, rgba(34, 211, 238, 0) 65%)",
          filter: "blur(80px)",
          mixBlendMode: "screen",
          animation: "oracle-drift-c 44s ease-in-out infinite alternate",
        }}
      />

      {/* 3. Stars — hash-distributed, uniform across the viewport */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.05}
            fill="#fffbeb"
            opacity={s.o}
            className={s.twinkles ? "oracle-twinkle" : undefined}
            style={s.twinkles ? { animationDelay: `${s.delay}s` } : undefined}
          />
        ))}
      </svg>

      {/* 4a. Dotted lattice — adds structure under the stars */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(252, 211, 77, 0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at 50% 35%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 35%, black 0%, transparent 75%)",
        }}
      />

      {/* 4b. Edge vignette — keeps content focal but lighter than before
              (was rgba(...,0.75)) so more of the dense star field survives
              at the corners. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, transparent 45%, rgba(3, 5, 10, 0.55) 100%)",
        }}
      />

      {/* 5. Top-of-page warm spotlight — anchors the cold-open hero */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "-10%",
          width: "100vw",
          height: "60vh",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(252, 211, 77, 0.16) 0%, rgba(252, 211, 77, 0.05) 30%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Aurora drift keyframes — slow, slow, slow. Disabled when the
          user has prefers-reduced-motion set (handled in globals.css). */}
      <style>{`
        @keyframes oracle-drift-a {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.55; }
          50%  { transform: translate3d(6%, 4%, 0) scale(1.08); opacity: 0.7; }
          100% { transform: translate3d(-3%, 8%, 0) scale(1.04); opacity: 0.5; }
        }
        @keyframes oracle-drift-b {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
          50%  { transform: translate3d(-8%, 6%, 0) scale(1.12); opacity: 0.7; }
          100% { transform: translate3d(5%, -3%, 0) scale(1.0); opacity: 0.55; }
        }
        @keyframes oracle-drift-c {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.4; }
          50%  { transform: translate3d(3%, -6%, 0) scale(1.06); opacity: 0.6; }
          100% { transform: translate3d(-6%, -2%, 0) scale(1.0); opacity: 0.5; }
        }
        @keyframes oracle-twinkle {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
        .oracle-twinkle {
          animation: oracle-twinkle 5.5s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .oracle-aurora { animation: none !important; }
          .oracle-twinkle { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
