"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: "amber" | "orange" | "red";
  alpha: number;
  life: number;
  maxLife: number;
}

export function FireSparksBackdrop() {
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
    const count = Math.round(160 * (isMobile ? 0.4 : 1));
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
      const hues: Spark["hue"][] = ["amber", "orange", "red"];
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

    const color = (hue: Spark["hue"], a: number) => {
      if (hue === "amber") return `rgba(251,191,36,${a})`;
      if (hue === "orange") return `rgba(249,115,22,${a})`;
      return `rgba(239,68,68,${a})`;
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
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.18), transparent 55%), radial-gradient(ellipse at 20% 85%, rgba(239,68,68,0.12), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(251,191,36,0.10), transparent 55%), #050202",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
