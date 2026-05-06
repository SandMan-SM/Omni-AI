"use client";

// InterlinkedConstellationBackdrop — animated constellation of floating
// nodes connected by faint lines whenever they drift close to each
// other. Visual metaphor for the manifesto's central idea: we were
// never separate to begin with. The lines pulse on draw, the nodes
// drift slowly, and the whole field reads as one organism rather than
// a screensaver.
//
// Performance: single canvas, no React re-renders during animation.
// Skips entirely under prefers-reduced-motion.

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pulse phase 0..1 — used to vary opacity per node so the field
   *  breathes rather than reading as a uniform field. */
  phase: number;
}

const NODE_COUNT_DESKTOP = 70;
const NODE_COUNT_MOBILE = 36;
/** Max distance (px) at which two nodes draw a connecting line.
 *  Beyond this, nodes drift unconnected. */
const LINK_RANGE = 150;

export function InterlinkedConstellationBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      const c = canvas;
      if (!c) return;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    const isMobile = window.innerWidth < 720;
    const nodes: Node[] = Array.from(
      { length: isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP },
      () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        // Slow drift — no node should travel across the screen in
        // less than ~30s at typical viewport widths.
        vx: (Math.random() - 0.5) * 0.18 * dpr,
        vy: (Math.random() - 0.5) * 0.18 * dpr,
        phase: Math.random(),
      }),
    );

    let raf = 0;
    let last = performance.now();

    function frame(now: number) {
      const c = canvas;
      if (!c || !ctx) return;
      const dt = Math.min(48, now - last); // clamp dt so a tab-switch
      last = now;                            // doesn't snap nodes around

      // Soft fade rather than full clear — this leaves a faint trail
      // on each line that gives the lattice a ghosted-after-image feel.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,5,5,0.25)";
      ctx.fillRect(0, 0, c.width, c.height);

      // Update positions
      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        // Wrap at the edges so the field stays full
        if (n.x < -8) n.x = c.width + 8;
        else if (n.x > c.width + 8) n.x = -8;
        if (n.y < -8) n.y = c.height + 8;
        else if (n.y > c.height + 8) n.y = -8;

        // Phase advance
        n.phase += 0.0006 * dt;
        if (n.phase > 1) n.phase -= 1;
      }

      // Connect nearby pairs
      const range = LINK_RANGE * dpr;
      ctx.lineWidth = 1 * dpr;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > range * range) continue;
          const d = Math.sqrt(d2);
          // Closer pair = stronger line; phase variation gives a
          // gentle pulse so the lattice isn't static.
          const proximity = 1 - d / range;
          const pulse =
            0.55 +
            0.45 *
              Math.sin((a.phase + b.phase) * Math.PI * 2);
          const alpha = proximity * proximity * 0.32 * pulse;
          ctx.strokeStyle = `rgba(251,191,36,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Draw nodes on top of lines
      for (const n of nodes) {
        const r =
          (1.4 + Math.sin(n.phase * Math.PI * 2) * 0.4) * dpr;
        const alpha = 0.55 + 0.35 * Math.sin(n.phase * Math.PI * 2);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4);
        grad.addColorStop(0, `rgba(255,245,184,${(alpha).toFixed(3)})`);
        grad.addColorStop(0.4, `rgba(251,191,36,${(alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1, "rgba(251,191,36,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,253,232,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return (
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
  );
}
