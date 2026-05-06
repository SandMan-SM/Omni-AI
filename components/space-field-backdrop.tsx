"use client";

// SpaceFieldBackdrop — full-viewport "space" effect lifted from the
// homepage hero (components/hero-section.tsx). Two layers:
//   1. Static radial-gradient glow pair (purple top-left, cyan bottom-
//      right) painted by a fixed div behind everything.
//   2. ~140 small purple/cyan particles drifting at slow velocities,
//      wrapping at the viewport edges. Same canvas physics + colors
//      as the hero so /system and /manifesto read as the same star
//      field the homepage hero sits in.
//
// Used as a backdrop layer (position: fixed, pointer-events: none).
// Respects prefers-reduced-motion — the particle animation is skipped
// entirely for users who request it; the static glow remains.

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Two color buckets so the field reads as the brand palette
   *  rather than a generic starfield — purple ≈ #a78bfa,
   *  cyan ≈ #22d3ee. */
  hue: "purple" | "cyan";
  alpha: number;
}

export function SpaceFieldBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    // Same density as the hero — 140 particles desktop, ~50 mobile.
    const count = Math.round(140 * (isMobile ? 0.35 : 1));
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      particles = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.6 + 0.3,
        hue: i % 2 === 0 ? "purple" : "cyan",
        alpha: Math.random() * 0.6 + 0.2,
      }));
    };

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5) p.x = width + 5;
        else if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        else if (p.y > height + 5) p.y = -5;
        ctx.fillStyle =
          p.hue === "purple"
            ? `rgba(167,139,250,${p.alpha})`
            : `rgba(34,211,238,${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    seed();
    draw();

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <>
      {/* Radial glow backdrop — same two-glow recipe as the hero so
          /system + /manifesto read as the same lit space the homepage
          hero sits in. Static (no JS) so it costs nothing to render. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 30% 40%, rgba(167,139,250,0.18), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(34,211,238,0.14), transparent 55%)",
        }}
      />

      {/* Particle canvas — drifts purple + cyan dots across the entire
          viewport. Fixed-position so the field follows the scroll. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    </>
  );
}
