'use client';

import { useEffect, useRef } from 'react';
import './legacy-tree.css';

export default function LegacyTree({ src = '/images/editorial/legacy-family-tree-v1.webp', alt = 'A monumental tree with a branching canopy, weathered trunk and exposed roots, representing generations connected by preserved knowledge.' }: { src?: string; alt?: string }) {
  const section = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const area = section.current;
    const windowFrame = frame.current;
    const artwork = image.current;
    if (!area || !windowFrame || !artwork) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pending = 0;
    const update = () => {
      pending = 0;
      const active = !preference.matches;
      area.dataset.motion = active ? 'on' : 'off';
      if (!active) { artwork.style.transform = ''; return; }
      const bounds = area.getBoundingClientRect();
      const stickyTop = parseFloat(getComputedStyle(windowFrame).top) || 0;
      const travel = Math.max(1, bounds.height - windowFrame.offsetHeight);
      const progress = Math.max(0, Math.min(1, (stickyTop - bounds.top) / travel));
      artwork.style.transform = `translate3d(0, ${-progress * 44.444444}%, 0)`;
      area.style.setProperty('--tree-progress', String(progress));
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    preference.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(pending);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      preference.removeEventListener('change', schedule);
    };
  }, []);

  return <section ref={section} className="legacy-tree-scroll" aria-label="Explore the family tree from canopy to roots">
    <div ref={frame} className="legacy-tree-window">
      {/* The complete image remains visible without JavaScript or with reduced motion. */}
      <img ref={image} src={src} width="1664" height="936" alt={alt} loading="lazy" decoding="async"/>
      <div className="legacy-tree-caption"><span>One tree. Many generations.</span><span className="legacy-tree-scroll-hint">Scroll to follow the branches to their roots</span></div>
      <div className="legacy-tree-progress" aria-hidden="true"/>
    </div>
  </section>;
}
