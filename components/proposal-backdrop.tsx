"use client";

// ProposalBackdrop — cinematic full-viewport background shared by
// /meta/proposal and /proposal/elitalks. Designed to read as "premium
// asset" the moment the page paints. Pure CSS + a single static
// <svg>, no canvas, no JS rAF. Respects prefers-reduced-motion.
//
// Layers, back-to-front:
//   1. Deep navy radial base
//   2. Horizon sweep beam (12s loop) — the "alive" pulse
//   3. Four drifting aurora orbs (amber + violet + cyan + amber-accent)
//      with mix-blend-mode: screen so they paint over each other.
//      Faster than v1 (18-26s vs 36-48s) so motion is perceptible.
//   4. Central nebula core — high-contrast amber glow behind the hero
//   5. ~280 hash-distributed stars. Bigger + brighter than v1.
//      ~40% twinkle on staggered phases. Brightest 15% get glow filter.
//   6. Constellation lines connecting select bright stars
//   7. Five shooting stars on long-tail offset delays
//   8. Amber dotted lattice with radial mask
//   9. Top warm spotlight
//   10. Edge vignette

function hash01(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

const STAR_COUNT = 280;

// Hand-picked constellation pairs — indices into the star array.
// Drawn first so they sit behind the stars themselves.
const CONSTELLATIONS: [number, number][] = [
  [3, 17], [17, 41], [41, 22], [22, 88],
  [55, 91], [91, 130], [130, 71], [71, 200],
];

// Five shooting stars with staggered phase offsets so the page
// always has at least one streak in flight without overlapping.
const METEORS = [
  { delay: 0,  duration: 4.5, top: "12%", left: "-10%" },
  { delay: 7,  duration: 5.2, top: "28%", left: "-5%"  },
  { delay: 14, duration: 4.8, top: "8%",  left: "-12%" },
  { delay: 21, duration: 5.5, top: "45%", left: "-8%"  },
  { delay: 28, duration: 4.2, top: "20%", left: "-15%" },
];

export function ProposalBackdrop() {
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
    const x = hash01(i, 1) * 100;
    const y = hash01(i, 2) * 100;
    // Bigger range: 0.8 - 3.2 px (was 0.5 - 1.9). Combined with the
    // SVG viewBox scaling below (r * 0.08 vs 0.05), this makes stars
    // visible on real screens instead of disappearing into the
    // noise floor.
    const r = 0.8 + hash01(i, 3) * 2.4;
    const o = 0.55 + hash01(i, 4) * 0.45;
    const twinkles = i % 5 < 2;
    const delay = hash01(i, 5) * 8;
    const duration = 4 + hash01(i, 6) * 4;
    const tone =
      i % 11 === 0
        ? "#fcd34d"
        : i % 17 === 0
          ? "#a78bfa"
          : i % 29 === 0
            ? "#7dd3fc"
            : "#fffbeb";
    const bright = o > 0.85;
    return { x, y, r, o, twinkles, delay, duration, tone, bright };
  });

  return (
    <div
      aria-hidden
      className="proposal-backdrop pointer-events-none fixed inset-0 -z-20 overflow-hidden"
    >
      {/* 1. Deep base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 25%, #0a0e1f 0%, #06080f 60%, #03050a 100%)",
        }}
      />

      {/* 2. Horizon sweep beam */}
      <div
        className="proposal-sweep absolute inset-x-[-20%] top-[40%] h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(252, 211, 77, 0.35), transparent)",
          filter: "blur(2px)",
        }}
      />

      {/* 3a. Amber aurora — top-left, fastest loop */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          top: "-18vh",
          left: "-18vw",
          width: "78vw",
          height: "78vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(252, 211, 77, 0.45) 0%, rgba(252, 211, 77, 0) 60%)",
          filter: "blur(72px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-a 18s ease-in-out infinite alternate",
        }}
      />

      {/* 3b. Violet counter-wash — top-right */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          top: "-12vh",
          right: "-22vw",
          width: "82vw",
          height: "82vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.38) 0%, rgba(167, 139, 250, 0) 62%)",
          filter: "blur(76px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-b 22s ease-in-out infinite alternate",
        }}
      />

      {/* 3c. Cyan deep — rises from below center */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          bottom: "-30vh",
          left: "8vw",
          width: "72vw",
          height: "72vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.32) 0%, rgba(56, 189, 248, 0) 65%)",
          filter: "blur(80px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-c 26s ease-in-out infinite alternate",
        }}
      />

      {/* 3d. Amber accent in lower-right for asymmetry */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          bottom: "-20vh",
          right: "-15vw",
          width: "55vw",
          height: "55vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(252, 211, 77, 0.28) 0%, rgba(252, 211, 77, 0) 65%)",
          filter: "blur(70px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-d 20s ease-in-out infinite alternate",
        }}
      />

      {/* 4. Central nebula core — backlight behind the hero copy */}
      <div
        className="proposal-nebula absolute"
        style={{
          top: "12vh",
          left: "50%",
          width: "65vw",
          height: "40vh",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(252, 211, 77, 0.20) 0%, rgba(167, 139, 250, 0.12) 35%, rgba(0, 0, 0, 0) 70%)",
          filter: "blur(40px)",
          mixBlendMode: "screen",
        }}
      />

      {/* 5 + 6. Stars + constellation lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="proposal-star-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {CONSTELLATIONS.map(([a, b], i) => {
          const s1 = stars[a];
          const s2 = stars[b];
          if (!s1 || !s2) return null;
          return (
            <line
              key={`c${i}`}
              x1={s1.x}
              y1={s1.y}
              x2={s2.x}
              y2={s2.y}
              stroke="rgba(252, 211, 77, 0.18)"
              strokeWidth="0.05"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.08}
            fill={s.tone}
            opacity={s.o}
            filter={s.bright ? "url(#proposal-star-glow)" : undefined}
            className={s.twinkles ? "proposal-twinkle" : undefined}
            style={
              s.twinkles
                ? {
                    animationDelay: `${s.delay}s`,
                    animationDuration: `${s.duration}s`,
                  }
                : undefined
            }
          />
        ))}
      </svg>

      {/* 7. Shooting stars */}
      {METEORS.map((m, i) => (
        <div
          key={`m${i}`}
          className="proposal-meteor absolute"
          style={{
            top: m.top,
            left: m.left,
            animation: `proposal-meteor ${m.duration}s linear infinite`,
            animationDelay: `${m.delay}s`,
          }}
        >
          <div
            style={{
              width: "180px",
              height: "1.5px",
              background:
                "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 251, 235, 0.9) 60%, rgba(252, 211, 77, 1) 100%)",
              boxShadow: "0 0 8px rgba(252, 211, 77, 0.8)",
              transform: "rotate(15deg)",
            }}
          />
        </div>
      ))}

      {/* 8. Amber dotted lattice */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(252, 211, 77, 0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, transparent 75%)",
        }}
      />

      {/* 9. Top spotlight */}
      <div
        className="absolute inset-x-0 top-0 h-[80vh]"
        style={{
          background:
            "radial-gradient(1100px 540px at 18% 6%, rgba(252, 211, 77, 0.50), transparent 58%), " +
            "radial-gradient(1000px 480px at 82% 12%, rgba(167, 139, 250, 0.40), transparent 58%), " +
            "radial-gradient(1400px 620px at 50% -5%, rgba(56, 189, 248, 0.26), transparent 58%)",
        }}
      />

      {/* 10. Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, transparent 55%, rgba(3, 5, 10, 0.7) 100%)",
        }}
      />

      <style>{`
        .proposal-nebula {
          transform: translateX(-50%);
          animation: proposal-nebula-pulse 8s ease-in-out infinite alternate;
        }
        @keyframes proposal-drift-a {
          0%   { transform: translate3d(0, 0, 0) scale(1);    opacity: 0.7; }
          50%  { transform: translate3d(10%, 8%, 0) scale(1.14); opacity: 0.95; }
          100% { transform: translate3d(-6%, 12%, 0) scale(1.08); opacity: 0.65; }
        }
        @keyframes proposal-drift-b {
          0%   { transform: translate3d(0, 0, 0) scale(1);    opacity: 0.6; }
          50%  { transform: translate3d(-12%, 10%, 0) scale(1.16); opacity: 0.88; }
          100% { transform: translate3d(8%, -6%, 0) scale(1.04); opacity: 0.7; }
        }
        @keyframes proposal-drift-c {
          0%   { transform: translate3d(0, 0, 0) scale(1);    opacity: 0.55; }
          50%  { transform: translate3d(6%, -10%, 0) scale(1.12); opacity: 0.8; }
          100% { transform: translate3d(-9%, -4%, 0) scale(1.06); opacity: 0.6; }
        }
        @keyframes proposal-drift-d {
          0%   { transform: translate3d(0, 0, 0) scale(1);    opacity: 0.6; }
          50%  { transform: translate3d(-7%, -6%, 0) scale(1.10); opacity: 0.85; }
          100% { transform: translate3d(10%, 4%, 0) scale(1.04); opacity: 0.65; }
        }
        @keyframes proposal-twinkle {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1; }
        }
        .proposal-twinkle {
          animation: proposal-twinkle 5.5s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes proposal-sweep {
          0%   { transform: translateX(-20%); opacity: 0; }
          25%  { opacity: 1; }
          50%  { transform: translateX(20%); opacity: 1; }
          75%  { opacity: 1; }
          100% { transform: translateX(60%); opacity: 0; }
        }
        .proposal-sweep {
          animation: proposal-sweep 12s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        @keyframes proposal-nebula-pulse {
          0%   { transform: translateX(-50%) scale(1);    opacity: 0.75; }
          100% { transform: translateX(-50%) scale(1.08); opacity: 1; }
        }
        @keyframes proposal-meteor {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          5%   { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate3d(120vw, 30vh, 0); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .proposal-aurora,
          .proposal-twinkle,
          .proposal-sweep,
          .proposal-nebula,
          .proposal-meteor {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
