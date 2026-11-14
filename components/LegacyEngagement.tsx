import './legacy-engagement.css';

export type LegacyPrinciplesData = {
  title: string;
  intro: string;
  items: { id: string; title: string; teaser: string; explanation: string }[];
};

export type LegacyReflectionData = {
  title: string;
  intro: string;
  questions: { question: string; reveal: string }[];
  privacyNote: string;
};

export function LegacyPrinciples({ data, id = 'legacy-principles' }: { data: LegacyPrinciplesData; id?: string }) {
  return <section className="legacy-engagement legacy-principles" aria-labelledby={id + '-title'}>
    <h3 className="legacy-engagement-title" id={id + '-title'}>{data.title}</h3>
    <p className="legacy-engagement-intro">{data.intro}</p>
    <div className="legacy-engagement-disclosures">{data.items.map(item => <details key={item.id}>
      <summary><span><strong>{item.title}</strong><span className="legacy-principle-teaser">{item.teaser}</span></span></summary>
      <p className="legacy-engagement-answer">{item.explanation}</p>
    </details>)}</div>
  </section>;
}

export function LegacyReflection({ data, id = 'legacy-reflection' }: { data: LegacyReflectionData; id?: string }) {
  return <section className="legacy-engagement legacy-reflection" aria-labelledby={id + '-title'}>
    <h3 className="legacy-engagement-title" id={id + '-title'}>{data.title}</h3>
    <p className="legacy-engagement-intro">{data.intro}</p>
    <div className="legacy-engagement-disclosures">{data.questions.map(item => <details key={item.question}>
      <summary><span>{item.question}</span></summary>
      <p className="legacy-engagement-answer">{item.reveal}</p>
    </details>)}</div>
    <p className="legacy-engagement-note">{data.privacyNote}</p>
  </section>;
}
