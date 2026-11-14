'use client';

import { useId, useState } from 'react';
import './legacy-engagement.css';

export type LegacyRetellingData = {
  title: string;
  scenario: string;
  note: string;
  options: { id: string; label: string; retelling: string; reveal: string }[];
};

export default function LegacyRetelling({ data }: { data: LegacyRetellingData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const instanceId = useId();
  const headingId = instanceId + '-retelling-title';
  const resultId = instanceId + '-retelling-result';
  const selected = data.options.find(option => option.id === selectedId);

  return <section className="legacy-engagement legacy-retelling" aria-labelledby={headingId}>
    <p className="legacy-engagement-kicker">Try the handoff</p>
    <h3 className="legacy-engagement-title" id={headingId}>{data.title}</h3>
    <p className="legacy-engagement-intro">{data.scenario}</p>
    <div className="legacy-retelling-controls" role="group" aria-label={data.scenario}>
      {data.options.map(option => <button type="button" key={option.id} aria-pressed={selectedId === option.id} aria-controls={resultId} onClick={() => setSelectedId(option.id)}>{option.label}</button>)}
    </div>
    <div className="legacy-retelling-live" id={resultId} aria-live="polite" aria-atomic="true">
      {selected ? <><blockquote className="legacy-retelling-quote">“{selected.retelling}”</blockquote><p className="legacy-retelling-reveal">{selected.reveal}</p></> : <p className="legacy-retelling-prompt">Choose a version to see what the grandson inherits.</p>}
    </div>
    <noscript><div className="legacy-retelling-fallback"><p>Both versions, side by side:</p>{data.options.map(option => <div key={option.id}><h4>{option.label}</h4><blockquote>“{option.retelling}”</blockquote><p>{option.reveal}</p></div>)}</div></noscript>
    <p className="legacy-engagement-note">{data.note}</p>
  </section>;
}
