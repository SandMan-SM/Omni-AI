"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// Gold variant of FireSparksBackdrop. Used on premium/chrome-gold
// surfaces (newsletter/premium/info, and anywhere the page is framed
// around the chrome-gold palette). Same canvas physics as fire
// sparks — just re-hued to the chrome-gold stops (#fff5b8 / #ffd700 /
// #b8860b) so the embers match the rest of the chrome-gold chrome.

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: "light" | "gold" | "deep";
  alpha: number;
  life: number;
  maxLife: number;
}

export function GoldSparksBackdrop() {
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
    // Perf: 100 desktop sparks (was 160). Each spark draws two arcs
    // per frame, so trimming the count is the cheapest way to cut the
    // per-frame canvas cost without losing the ember texture. Mobile
    // keeps the 0.4× multiplier.
    const count = Math.round(100 * (isMobile ? 0.4 : 1));
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

    const spawn = (): Spark => {
      const hues: Spark["hue"][] = ["light", "gold", "gold", "deep"];
      const maxLife = 180 + Math.random() * 220;
      return {
        x: Math.random() * width,
        y: height + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(Math.random() * 0.7 + 0.35),
        r: Math.random() * 1.6 + 0.4,
        hue: hues[Math.floor(Math.random() * hues.length)],
        alpha: Math.random() * 0.55 + 0.3,
        life: 0,
        maxLife,
      };
    };

    const seed = () => {
      sparks = Array.from({ length: count }, () => {
        const s = spawn();
        s.y = Math.random() * height;
        s.life = Math.random() * s.maxLife;
        return s;
      });
    };

    // Chrome-gold stops, same as the gradient borders elsewhere on the
    // site so the ember colors read as the same metal.
    const color = (hue: Spark["hue"], a: number) => {
      if (hue === "light") return `rgba(255,245,184,${a})`; // #fff5b8
      if (hue === "gold") return `rgba(255,215,0,${a})`;    // #ffd700
      return `rgba(184,134,11,${a})`;                        // #b8860b
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx += (Math.random() - 0.5) * 0.04;
        s.life += 1;

        const t = s.life / s.maxLife;
        const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        const a = Math.max(0, s.alpha * fade);

        ctx.fillStyle = color(s.hue, a);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color(s.hue, a * 0.25);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
        ctx.fill();

        if (s.life >= s.maxLife || s.y < -20) {
          sparks[i] = spawn();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    seed();
    draw();

    const onResize = () => {
      resize();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ contain: "strict" }}
    >
      <div
        className="absolute inset-0"
        style={{
          // Warm dark base with three gold radial washes. Mirrors
          // FireSparks' structure but every stop is a chrome-gold
          // color instead of fire/ember red.
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(255,215,0,0.14), transparent 55%), " +
            "radial-gradient(ellipse at 20% 85%, rgba(184,134,11,0.10), transparent 50%), " +
            "radial-gradient(ellipse at 80% 80%, rgba(255,245,184,0.08), transparent 55%), " +
            "#060402",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
