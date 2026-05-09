// Cosmic background for case-study pages.
// Fixed within its containing section (use inside a `relative` parent).
// Aurora drift + 96 deterministic twinkling stars + dotted grid + spotlight.
// All GPU-accelerated CSS, no JS, no hydration mismatch.

const STAR_COUNT = 140;

// xmur3 + sfc32 — proven uniform-distribution hash. Avoids the modular
// banding that `(i * 89) % 100` produces (only 10 distinct y-values for
// 100 stars → visible horizontal lines).
function hash01(i: number, seed: number): number {
  let h = (i + 1) * 0x9e3779b1 + seed * 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}

function star(i: number) {
  const x = hash01(i, 1) * 100;
  const y = hash01(i, 2) * 100;
  const size = 0.6 + hash01(i, 3) * 1.8;
  const delay = hash01(i, 4) * 8;
  const dur = 2.4 + hash01(i, 5) * 4;
  const opacity = 0.3 + hash01(i, 6) * 0.6;
  return { x, y, size, delay, dur, opacity };
}

export default function CaseCosmicBackground() {
  return (
    <div
      aria-hidden
      className="case-cosmic-bg pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />
      <div className="vignette" />
      <div className="stars">
        {Array.from({ length: STAR_COUNT }).map((_, i) => {
          const s = star(i);
          return (
            <span
              key={i}
              className="star"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
                ["--star-opacity" as string]: String(s.opacity),
              }}
            />
          );
        })}
      </div>
      <div className="grid-dots" />
      <div className="spotlight" />
    </div>
  );
}
