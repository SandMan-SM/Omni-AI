"use client";

/**
 * Red sparks field — ambient canvas background for newsletter post pages.
 * Embers drift slowly upward; a few hot-orange sparks twinkle among them.
 * Pauses for prefers-reduced-motion. Scales density on mobile.
 */

import { useEffect, useRef } from "react";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  targetAlpha: number;
  hot: boolean;
}

export function RedSparks() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const count = Math.round(90 * (isMobile ? 0.4 : 1));
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    let width = 0;
    let height = 0;
    let sparks: Spark[] = [];

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
      sparks = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        // Embers drift upward
        vy: -(Math.random() * 0.28 + 0.06),
        r: Math.random() * 1.4 + 0.4,
        alpha: Math.random() * 0.5 + 0.15,
        targetAlpha: Math.random() * 0.75 + 0.15,
        // ~18% of particles are hot-orange, the rest are deep red
        hot: Math.random() < 0.18,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;

        // Twinkle: lerp alpha toward a random target
        s.alpha += (s.targetAlpha - s.alpha) * 0.02;
        if (Math.abs(s.alpha - s.targetAlpha) < 0.01) {
          s.targetAlpha = Math.random() * 0.75 + 0.15;
        }

        // Wrap. Embers exit the top → respawn at the bottom.
        if (s.x < -6) s.x = width + 6;
        else if (s.x > width + 6) s.x = -6;
        if (s.y < -6) {
          s.y = height + 6;
          s.x = Math.random() * width;
        }

        const color = s.hot
          ? `rgba(255,140,60,${s.alpha})`
          : `rgba(239,68,68,${s.alpha})`;
        ctx.fillStyle = color;
        ctx.shadowBlur = s.hot ? 10 : 6;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {/* Soft red wash behind the sparks */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 25% 15%, rgba(239,68,68,0.12), transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(255,140,60,0.07), transparent 55%)",
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      />
    </>
  );
}
