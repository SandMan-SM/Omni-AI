"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { Sparkles, Clock, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

const metrics = [
  { icon: Clock, value: "24/7", label: "Execution" },
  { icon: Users, value: "13", label: "Subscribers" },
  { icon: Eye, value: "2k+", label: "Impressions" },
];

const partners = [
  { name: "Nvidia", logo: "/logos/nvidia.svg" },
  { name: "Meta", logo: "/logos/meta.svg" },
  { name: "Claude", logo: "/logos/claude.svg" },
  { name: "OpenAI", logo: "/logos/openai.svg" },
  { name: "Gemini", logo: "/logos/gemini.svg" },
  { name: "Grok", logo: "/logos/grok.svg" },
  { name: "Perplexity", logo: "/logos/perplexity.svg" },
];

interface HeroSectionProps {
  onBookDemo?: () => void;
  onSignIn?: () => void;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; r: number; hue: "purple" | "cyan"; alpha: number;
}

export function HeroSection({ onBookDemo, onSignIn }: HeroSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const count = Math.round(140 * (isMobile ? 0.35 : 1));
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    let width = 0, height = 0;
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
        p.x += p.vx;
        p.y += p.vy;
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
        if (p.x < -5) p.x = width + 5;
        else if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        else if (p.y > height + 5) p.y = -5;
        ctx.fillStyle = p.hue === "purple"
          ? `rgba(167,139,250,${p.alpha})`
          : `rgba(34,211,238,${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    resize(); seed(); draw();
    const onResize = () => { resize(); seed(); };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
  }, []);

  const onPointerLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  return (
    <section
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative min-h-[100svh] px-5 overflow-hidden"
      style={{ paddingTop: 'clamp(120px, 20vh, 200px)' }}
    >
      {/* Radial glow backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 40%, rgba(167,139,250,0.18), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(34,211,238,0.14), transparent 55%)",
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-5xl mx-auto flex flex-col items-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 md:mb-8 rounded-full glass-card neon-border whitespace-nowrap"
        >
          <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-400 flex-shrink-0" />
          <span className="text-[10px] sm:text-[11px] md:text-xs text-gray-300 tracking-wide">
            Introducing the world&apos;s first AGI Legacy Model
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tight mb-6 whitespace-nowrap"
          style={{
            backgroundImage: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #67e8f9 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 80px rgba(167,139,250,0.25)",
          }}
        >
          Welcome to AGI
        </motion.h1>

        {/* data-speakable="intro" activates the second CSS selector in
            the SpeakableSpecification declared on homepageWebPageSchema
            (rendered inline in app/page.tsx). Voice assistants (Google
            Assistant, Siri, Alexa) asked "what is Omni AI?" / "tell me
            about Omni AI" / "what does Omni AI do?" concatenate h1
            ("Welcome to AGI") + this subtitle as the natural ~9-second
            hero-intent reply. The homepage is the single highest-
            leverage voice-retrieval surface on the site — hero-intent
            queries always land here, so making this pair quotable is
            the step that pulls the most LLM citation weight per edit. */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-sm sm:text-lg md:text-xl text-gray-400 max-w-lg md:max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed"
          data-speakable="intro"
        >
          Autonomous AGI systems that generate leads, run operations, and scale
          businesses without human micromanagement.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-row items-center justify-center gap-4"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-cyan-500 border-0 text-white px-10 h-12 sm:h-11 text-[15px] font-medium rounded-xl shadow-[0_0_40px_rgba(167,139,250,0.35)] hover:shadow-[0_0_60px_rgba(167,139,250,0.55)] active:scale-[0.98] transition-all"
            onClick={() => router.push("/interlinked")}
            data-testid="button-interlinked"
          >
            Interlinked
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/[0.03] backdrop-blur-sm text-white px-10 h-12 sm:h-11 text-[15px] font-medium rounded-xl hover:bg-white/[0.06] active:scale-[0.98] transition-all"
            onClick={() => { if (user) router.push("/dashboard"); else onSignIn?.(); }}
            data-testid="button-sign-in"
          >
            Sign In
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="grid grid-cols-3 gap-4 sm:gap-14 md:gap-20 w-full max-w-sm sm:max-w-xl md:max-w-2xl px-2"
          style={{ marginTop: '60px' }}
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 1 + index * 0.1 }}
              className="flex flex-col items-center text-center gap-2"
              data-testid={`metric-${metric.label.toLowerCase()}`}
            >
              <metric.icon className="w-5 h-5 text-purple-400" />
              <span
                className="text-2xl md:text-3xl font-bold"
                style={{
                  backgroundImage: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #67e8f9 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {metric.value}
              </span>
              <span className="text-[11px] sm:text-xs text-gray-500 tracking-wide">
                {metric.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="flex flex-col items-center gap-4 pt-12 pb-2"
        >
          <span className="text-sm sm:text-base text-white/80 tracking-wider">
            Partnered with platforms like
          </span>
          <div
            className="flex flex-nowrap items-center justify-center mx-auto pb-2 px-4 max-w-full"
            style={{ gap: "clamp(12px, 3vw, 33px)" }}
          >
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="flex items-center justify-center shrink-0"
                style={{ width: "clamp(40px, 11vw, 100px)", height: "clamp(40px, 11vw, 100px)" }}
              >
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={100}
                  height={100}
                  className="object-contain opacity-90 hover:opacity-100 transition-opacity w-full h-full"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
