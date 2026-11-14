'use client';

import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import './family-legacy-hero.css';

const profiles = [
  { left: '16%', top: '20%' },
  { left: '38%', top: '20%' },
  { left: '62%', top: '20%' },
  { left: '84%', top: '20%' },
  { left: '31%', top: '48.5%' },
  { left: '69%', top: '48.5%' },
  { left: '50%', top: '77.5%' },
] as const;

export default function FamilyLegacyHero({
  src = '/images/editorial/legacy-family-tree-v2.webp',
  alt = 'Conceptual three-dimensional family legacy tree, with seven blank glass profile cards connected to its branches and roots. These illustrative profiles do not represent real family members.',
}: { src?: string; alt?: string }) {
  const [activeProfile, setActiveProfile] = useState<number | null>(null);
  const profileButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const instanceId = useId();
  const panelId = instanceId + '-profile';
  const headingId = instanceId + '-heading';

  const closeProfile = () => {
    const previousProfile = activeProfile;
    setActiveProfile(null);
    if (previousProfile !== null) profileButtons.current[previousProfile]?.focus({ preventScroll: true });
  };

  return <figure className="family-legacy-hero" onKeyDown={event => {
    if (event.key === 'Escape' && activeProfile !== null) closeProfile();
  }}>
    <div className="family-legacy-artwork">
      <Image src={src} alt={alt} width={1664} height={936} priority loading="eager" sizes="(max-width: 1100px) 90vw, 1100px" className="family-legacy-image"/>
      {profiles.map((position, index) => <button
        key={index}
        ref={element => { profileButtons.current[index] = element; }}
        type="button"
        className="family-legacy-profile"
        style={position}
        aria-expanded={activeProfile === index}
        aria-controls={panelId}
        onClick={() => setActiveProfile(current => current === index ? null : index)}
      ><span className="family-legacy-sr-only">Open blank family profile {index + 1}</span></button>)}
    </div>
    <figcaption className="family-legacy-caption">Tap a profile to explore what could be preserved.</figcaption>
    <div className="family-legacy-preview" id={panelId} role="region" aria-labelledby={headingId} hidden={activeProfile === null}>
      {activeProfile !== null ? <>
        <div className="family-legacy-preview-heading"><h2 id={headingId}>Blank family profile {activeProfile + 1}</h2><button type="button" onClick={closeProfile} className="family-legacy-close" aria-label="Close blank family profile preview">Close <span aria-hidden="true">×</span></button></div>
        <dl className="family-legacy-records">{['Original voice', 'Lessons', 'Story & context'].map(label => <div key={label}><dt>{label}</dt><dd>Not recorded yet</dd></div>)}</dl>
        <p className="family-legacy-disclaimer">Illustrative profile preview. No family data is entered or stored.</p>
      </> : null}
    </div>
  </figure>;
}
