"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

export interface VoidHeroCTA {
  label: string;
  onClick?: () => void;
  href?: string;
  ariaLabel?: string;
}

export interface VoidHeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  primaryCta?: VoidHeroCTA;
  secondaryCta?: VoidHeroCTA;
  /** Desktop particle count. Auto-scaled down on mobile / reduced motion. Default 120. */
  particleDensity?: number;
  /** Force theme instead of following system / html class. */
  theme?: "dark" | "light";
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: "purple" | "cyan";
  alpha: number;
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function VoidHero({
  eyebrow = "OMNI AI",
  title = "Intelligence, in the dark.",
  subtitle = "A high-contrast interactive hero inspired by your black visual. Smooth motion, subtle depth, and responsive behavior.",
  primaryCta = { label: "Get Started" },
  secondaryCta = { label: "View Demo" },
  particleDensity = 120,
  theme,
  className = "",
}: VoidHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(theme ?? "dark");

  // Theme resolution — respect prop, else follow html.dark class / media query
  useEffect(() => {
    if (theme) {
      setResolvedTheme(theme);
      return;
    }
    const root = document.documentElement;
    const update = () => {
      if (root.classList.contains("dark")) setResolvedTheme("dark");
      else if (root.classList.contains("light")) setResolvedTheme("light");
      else setResolvedTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    };
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, [theme]);

  // Particle field
  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const count = Math.round(particleDensity * (isMobile ? 0.35 : 1));
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        // Gentle drift
        p.x += p.vx;
        p.y += p.vy;

        // Mouse parallax pull
        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 180) {
            const f = (180 - dist) / 180;
            p.x += (dx / dist) * f * 0.6;
            p.y += (dy / dist) * f * 0.6;
          }
        }

        // Wrap edges
        if (p.x < -5) p.x = width + 5;
        else if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        else if (p.y > height + 5) p.y = -5;

        const color =
          p.hue === "purple"
            ? resolvedTheme === "dark"
              ? `rgba(167,139,250,${p.alpha})`
              : `rgba(109,40,217,${p.alpha * 0.7})`
            : resolvedTheme === "dark"
              ? `rgba(34,211,238,${p.alpha})`
              : `rgba(8,145,178,${p.alpha * 0.7})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
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
  }, [particleDensity, prefersReducedMotion, resolvedTheme]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
  }, []);

  const onPointerLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  const handleCta = (cta: VoidHeroCTA) => {
    if (cta.href) window.location.assign(cta.href);
    else cta.onClick?.();
  };

  const isDark = resolvedTheme === "dark";

  return (
    <section
      aria-label="Cinematic hero"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`relative overflow-hidden min-h-[100svh] flex items-center justify-center ${
        isDark ? "bg-[#050505] text-white" : "bg-white text-slate-900"
      } ${className}`}
    >
      {/* Radial glow backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 30% 40%, rgba(167,139,250,0.18), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(34,211,238,0.14), transparent 55%)"
            : "radial-gradient(ellipse at 30% 40%, rgba(139,92,246,0.12), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(6,182,212,0.1), transparent 55%)",
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 text-center max-w-3xl mx-auto px-6"
      >
        {eyebrow && (
          <motion.p
            variants={itemVariants}
            className={`text-xs md:text-sm tracking-[0.3em] font-medium mb-5 ${
              isDark ? "text-purple-300/80" : "text-purple-700"
            }`}
          >
            {eyebrow}
          </motion.p>
        )}

        <motion.h1
          variants={itemVariants}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          style={{
            backgroundImage: isDark
              ? "linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #67e8f9 100%)"
              : "linear-gradient(135deg, #0f172a 0%, #6d28d9 50%, #0e7490 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: isDark ? "0 0 80px rgba(167,139,250,0.25)" : "none",
          }}
        >
          {title}
        </motion.h1>

        {subtitle && (
          <motion.p
            variants={itemVariants}
            className={`text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-10 ${
              isDark ? "text-gray-400" : "text-slate-600"
            }`}
          >
            {subtitle}
          </motion.p>
        )}

        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {primaryCta && (
            <button
              type="button"
              onClick={() => handleCta(primaryCta)}
              aria-label={primaryCta.ariaLabel ?? primaryCta.label}
              className={`group relative inline-flex items-center justify-center h-12 px-8 rounded-xl font-medium text-[15px] transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isDark
                    ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_0_40px_rgba(167,139,250,0.35)] hover:shadow-[0_0_60px_rgba(167,139,250,0.55)] focus-visible:ring-purple-400 focus-visible:ring-offset-black"
                    : "bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:brightness-110 focus-visible:ring-purple-500 focus-visible:ring-offset-white"
                } active:scale-[0.98]`}
            >
              {primaryCta.label}
            </button>
          )}
          {secondaryCta && (
            <button
              type="button"
              onClick={() => handleCta(secondaryCta)}
              aria-label={secondaryCta.ariaLabel ?? secondaryCta.label}
              className={`inline-flex items-center justify-center h-12 px-8 rounded-xl font-medium text-[15px] transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isDark
                    ? "border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.06] focus-visible:ring-white/40 focus-visible:ring-offset-black"
                    : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-400 focus-visible:ring-offset-white"
                } active:scale-[0.98]`}
            >
              {secondaryCta.label}
            </button>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
