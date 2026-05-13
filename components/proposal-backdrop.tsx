"use client";

// ProposalBackdrop — cinematic full-viewport background for /meta/proposal.
//
// Replaces the prior inline aurora-mesh + hex-grid + beams stack with a
// richer, more "this is the next $100K of creative" cosmic field. Same
// pattern that landed on /oracle (which the operator approved + then
// enhanced to 280 stars + twinkle) — re-tuned for this page's amber +
// violet + cyan palette and the proposal's "proscenium spotlight" feel.
//
// Layered passes (back-to-front):
//   1. Deep navy/black radial base
//   2. Three drifting aurora blobs (amber, violet, cyan) on slow loops
//      with mix-blend-mode: screen so they paint over each other
//   3. ~260 hash-distributed stars (xmur3 hash → uniform density,
//      no banding); every 3rd star twinkles via opacity keyframes
//   4. Faint amber dotted lattice with radial mask
//   5. Top warm spotlight that anchors the hero
//   6. Edge vignette so content stays focal
//
// All pure CSS + a single static <svg>. No canvas, no JS rAF — fast,
// respects prefers-reduced-motion automatically.

function hash01(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

const STAR_COUNT = 260;

export function ProposalBackdrop() {
  // Pre-compute star positions, sizes, opacities, twinkle delays so SSR
  // and CSR match exactly (deterministic from the hash).
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
    const x = hash01(i, 1) * 100;
    const y = hash01(i, 2) * 100;
    const r = 0.5 + hash01(i, 3) * 1.4; // 0.5 – 1.9 px
    const o = 0.4 + hash01(i, 4) * 0.6; // 0.4 – 1.0 brightness
    const twinkles = i % 3 === 0;
    const delay = hash01(i, 5) * 6; // 0 – 6s phase offset
    // Subtle palette mix — most stars warm white, a few amber, a few
    // violet for variety. Keeps the field reading as cosmic, not generic.
    const tone = i % 11 === 0 ? "#fcd34d" : i % 17 === 0 ? "#a78bfa" : "#fffbeb";
    return { x, y, r, o, twinkles, delay, tone };
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

      {/* 2a. Amber aurora — top-left, longest loop */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          top: "-18vh",
          left: "-18vw",
          width: "78vw",
          height: "78vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(252, 211, 77, 0.30) 0%, rgba(252, 211, 77, 0) 60%)",
          filter: "blur(72px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-a 36s ease-in-out infinite alternate",
        }}
      />

      {/* 2b. Violet counter-wash — top-right */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          top: "-12vh",
          right: "-22vw",
          width: "82vw",
          height: "82vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.24) 0%, rgba(167, 139, 250, 0) 62%)",
          filter: "blur(76px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-b 42s ease-in-out infinite alternate",
        }}
      />

      {/* 2c. Cyan deep — rises from below center */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          bottom: "-30vh",
          left: "8vw",
          width: "72vw",
          height: "72vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0) 65%)",
          filter: "blur(80px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-c 48s ease-in-out infinite alternate",
        }}
      />

      {/* 2d. Amber accent in lower-right for asymmetry — keeps the
              composition from feeling perfectly mirror-balanced. */}
      <div
        className="proposal-aurora absolute rounded-full"
        style={{
          bottom: "-20vh",
          right: "-15vw",
          width: "55vw",
          height: "55vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(252, 211, 77, 0.16) 0%, rgba(252, 211, 77, 0) 65%)",
          filter: "blur(70px)",
          mixBlendMode: "screen",
          animation: "proposal-drift-d 40s ease-in-out infinite alternate",
        }}
      />

      {/* 3. Stars — uniform via hash distribution; every 3rd twinkles */}
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
            fill={s.tone}
            opacity={s.o}
            className={s.twinkles ? "proposal-twinkle" : undefined}
            style={s.twinkles ? { animationDelay: `${s.delay}s` } : undefined}
          />
        ))}
      </svg>

      {/* 4. Amber dotted lattice with radial mask */}
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

      {/* 5. Top spotlight — concentrated cosmic glow above the hero.
              Three colors stacked: amber from upper-left, violet from
              upper-right, cyan rising from below center. Stronger than
              the aurora so the hero gets unmistakable warmth. */}
      <div
        className="absolute inset-x-0 top-0 h-[80vh]"
        style={{
          background:
            "radial-gradient(1100px 540px at 18% 6%, rgba(252, 211, 77, 0.45), transparent 58%), " +
            "radial-gradient(1000px 480px at 82% 12%, rgba(167, 139, 250, 0.35), transparent 58%), " +
            "radial-gradient(1400px 620px at 50% -5%, rgba(56, 189, 248, 0.22), transparent 58%)",
        }}
      />

      {/* 6. Edge vignette — keeps content focal */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, transparent 50%, rgba(3, 5, 10, 0.65) 100%)",
        }}
      />

      <style>{`
        @keyframes proposal-drift-a {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.6; }
          50%  { transform: translate3d(7%, 5%, 0) scale(1.10); opacity: 0.78; }
          100% { transform: translate3d(-4%, 9%, 0) scale(1.05); opacity: 0.55; }
        }
        @keyframes proposal-drift-b {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.55; }
          50%  { transform: translate3d(-9%, 7%, 0) scale(1.12); opacity: 0.75; }
          100% { transform: translate3d(6%, -4%, 0) scale(1.0); opacity: 0.6; }
        }
        @keyframes proposal-drift-c {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.45; }
          50%  { transform: translate3d(4%, -7%, 0) scale(1.08); opacity: 0.66; }
          100% { transform: translate3d(-7%, -3%, 0) scale(1.0); opacity: 0.5; }
        }
        @keyframes proposal-drift-d {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
          50%  { transform: translate3d(-5%, -4%, 0) scale(1.07); opacity: 0.7; }
          100% { transform: translate3d(8%, 2%, 0) scale(1.02); opacity: 0.55; }
        }
        @keyframes proposal-twinkle {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
        .proposal-twinkle {
          animation: proposal-twinkle 5.5s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .proposal-aurora,
          .proposal-twinkle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
