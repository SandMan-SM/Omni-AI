'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import './family-legacy-hero.css';

export default function FamilyLegacyHero({
  src = '/images/editorial/legacy-family-tree-v2.webp',
  alt = 'A dimensional family legacy tree with seven blank digital profiles integrated into its branches and roots. Conceptual illustration, not real family records.',
}: { src?: string; alt?: string }) {
  const scene = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pending = 0;
    let visible = false;
    const update = () => {
      pending = 0;
      if (preference.matches) {
        delete element.dataset.motion;
        element.style.removeProperty('--tree-pan');
        element.style.removeProperty('--tree-tilt');
        element.style.removeProperty('--tree-depth');
        return;
      }
      const bounds = element.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (window.innerHeight * .88 - bounds.top) / (window.innerHeight * .65 + bounds.height * .35)));
      element.dataset.motion = 'on';
      element.style.setProperty('--tree-pan', `${(3.8 - progress * 7.6).toFixed(3)}%`);
      element.style.setProperty('--tree-tilt', `${(4 - progress * 8).toFixed(3)}deg`);
      element.style.setProperty('--tree-depth', (1.18 + Math.sin(progress * Math.PI) * .045).toFixed(4));
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

  return <figure ref={scene} className="family-legacy-hero" aria-label="Family legacy tree, revealed with the page scroll">
    <div className="family-legacy-artwork">
      <Image src={src} alt={alt} width={1664} height={936} priority loading="eager" sizes="(max-width: 1100px) 90vw, 1100px" className="family-legacy-image"/>
    </div>
    <figcaption className="family-legacy-caption">One tree. Generations of knowledge. Scroll to follow the roots.</figcaption>
  </figure>;
}
