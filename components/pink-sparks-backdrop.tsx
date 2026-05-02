"use client";

// Pink/magenta/purple sparks backdrop. Same pattern as FireSparksBackdrop
// but recoloured for pages that use the purple→pink gradient (sponsor
// program surfaces). Fixed-position canvas behind everything; pointer
// events disabled. Respects prefers-reduced-motion.

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: "pink" | "magenta" | "purple";
  alpha: number;
  life: number;
  maxLife: number;
}

export function PinkSparksBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const count = Math.round(150 * (isMobile ? 0.4 : 1));
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

    const hueFor = (i: number): Spark["hue"] => {
      const m = i % 3;
      return m === 0 ? "pink" : m === 1 ? "magenta" : "purple";
    };

    const spawn = (i: number): Spark => ({
      x: Math.random() * width,
      y: height + Math.random() * 60,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(Math.random() * 0.6 + 0.25),
      r: Math.random() * 1.6 + 0.4,
      hue: hueFor(i),
      alpha: Math.random() * 0.55 + 0.2,
      life: 0,
      maxLife: Math.random() * 320 + 220,
    });

    const seed = () => {
      sparks = Array.from({ length: count }, (_, i) => {
        const s = spawn(i);
        // pre-distribute on first paint so the page isn't empty
        s.y = Math.random() * height;
        s.life = Math.random() * s.maxLife;
        return s;
      });
    };

    const colorFor = (hue: Spark["hue"], a: number) => {
      switch (hue) {
        case "pink":    return `rgba(244, 114, 182, ${a})`; // tailwind pink-400
        case "magenta": return `rgba(217, 70, 239, ${a})`;  // fuchsia-500
        case "purple":  return `rgba(168, 85, 247, ${a})`;  // purple-500
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.life += 1;
        s.x += s.vx;
        s.y += s.vy;

        const fade =
          s.life < 60
            ? s.life / 60
            : s.life > s.maxLife - 80
            ? Math.max(0, (s.maxLife - s.life) / 80)
            : 1;

        const a = s.alpha * fade;
        ctx.beginPath();
        ctx.fillStyle = colorFor(s.hue, a);
        ctx.shadowColor = colorFor(s.hue, a * 0.8);
        ctx.shadowBlur = s.r * 6;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.life > s.maxLife || s.y < -20 || s.x < -20 || s.x > width + 20) {
          sparks[i] = spawn(i);
        }
      }

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* base gradient wash — purple/pink radial bloom anchored bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0410] via-black to-[#0a0410]" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] rounded-full bg-gradient-to-t from-pink-500/20 via-fuchsia-500/10 to-transparent blur-3xl" />
      <div className="absolute -top-32 -left-20 w-[520px] h-[520px] rounded-full bg-purple-500/15 blur-3xl" />
      <div className="absolute -top-24 -right-10 w-[420px] h-[420px] rounded-full bg-pink-500/10 blur-3xl" />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
