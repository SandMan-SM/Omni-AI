'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import './family-legacy-hero.css';

export default function FamilyLegacyHero({
  src = '/images/editorial/legacy-family-tree-v2.webp',
  alt = 'A dimensional family legacy tree with seven blank digital profiles integrated into its branches and roots. Conceptual illustration, not real family records.',
}: { src?: string; alt?: string }) {
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pending = 0;
    let visible = false;
    const reset = () => {
      delete element.dataset.motion;
      element.removeAttribute('style');
    };
    const update = () => {
      pending = 0;
      if (preference.matches) {
        reset();
        return;
      }
      const bounds = element.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (window.innerHeight * .62 - bounds.top) / (window.innerHeight * .58 + bounds.height * .15)));
      const ease = (value: number) => value * value * (3 - 2 * value);
      const approach = ease(Math.min(1, progress / .28));
      const descent = ease(Math.max(0, (progress - .28) / .72));
      element.dataset.motion = 'on';
      element.style.setProperty('--tree-pan', `${(11 * approach - 29 * descent).toFixed(3)}%`);
      element.style.setProperty('--tree-tilt', `${((2 - progress * 6) * approach).toFixed(3)}deg`);
      element.style.setProperty('--tree-yaw', `${((-4 + progress * 8) * approach).toFixed(3)}deg`);
      element.style.setProperty('--tree-depth', (1.04 + approach * .7).toFixed(4));
    };
    const schedule = () => { if (!pending && (visible || preference.matches)) pending = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) schedule();
    }, { rootMargin: '120px' });
    observer.observe(element);
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    preference.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(pending);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      preference.removeEventListener('change', update);
    };
  }, []);

  return <div ref={scene} className="family-legacy-sequence">
    <figure className="family-legacy-hero" aria-label="Family legacy tree, from canopy to roots as you scroll">
      <div className="family-legacy-artwork">
        <Image src={src} alt={alt} width={1664} height={936} priority loading="eager" sizes="(max-width: 1100px) 90vw, 1100px" className="family-legacy-image"/>
      </div>
    </figure>
  </div>;
}
