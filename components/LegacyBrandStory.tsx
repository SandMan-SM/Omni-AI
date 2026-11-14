import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import FamilyLegacyHero from '@/components/FamilyLegacyHero';
import LegacyRetelling from '@/components/LegacyRetelling';
import { LegacyPrinciples, LegacyReflection } from '@/components/LegacyEngagement';
import LegacyArticleShare from '@/components/LegacyArticleShare';
import article from '@/lib/legacy-brand-article.json';
import { getNewsletterFallbackSummaries } from '@/lib/newsletter-fallback';
import { NewsletterIssueCard } from '@/components/newsletter-issue-card';
import { NewsletterHeader } from '@/components/newsletter-premium-gate';
import { Footer } from '@/components/footer';
import './legacy-brand-story.css';

export const LEGACY_BRAND_POST_SLUG = article.slug;
const origin = 'https://omnileadsagi.com';
const url = `${origin}/newsletter/${LEGACY_BRAND_POST_SLUG}`;
const image = `${origin}/images/editorial/legacy-family-tree-v2.webp`;
const imageAlt = 'Conceptual three-dimensional family legacy tree with seven blank glass profile cards integrated into its branches and roots; no real family records or identities are shown.';
const bodyText = [...article.intro, ...article.sections.flatMap(section => [section.heading, ...section.paragraphs, ...('items' in section ? section.items ?? [] : [])]), ...article.faq.flatMap(item => [item.question, item.answer])].join('\n\n');
const minutes = 5;

export function legacyBrandMetadata(): Metadata {
  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    authors: [article.author],
    alternates: { canonical: url, types: { 'application/rss+xml': `${origin}/newsletter/rss.xml` } },
    openGraph: { type: 'article', title: article.title, description: article.description, url, siteName: 'Omni AI', locale: 'en_US', publishedTime: `${article.date}T00:00:00.000Z`, modifiedTime: `${article.date}T00:00:00.000Z`, authors: [article.author.url], tags: article.keywords, images: [{ url: image, width: 1664, height: 936, type: 'image/webp', alt: imageAlt }] },
    twitter: { card: 'summary_large_image', site: '@SitaniMafi', creator: '@SitaniMafi', title: article.title, description: article.description, images: [{ url: image, alt: imageAlt }] },
  };
}
export default function LegacyBrandStory() {
  const related = getNewsletterFallbackSummaries().filter(post => post.slug !== article.slug && /memory|nervous|system|knowledge|thinking/i.test(`${post.subject} ${post.intro}`)).slice(0, 3);
  const structured = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', '@id': `${url}#article`, headline: article.title, description: article.description, articleBody: bodyText, articleSection: 'Perspective', datePublished: `${article.date}T00:00:00.000Z`, dateModified: `${article.date}T00:00:00.000Z`, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, url, inLanguage: 'en-US', isAccessibleForFree: true, wordCount: bodyText.split(/\s+/).length, timeRequired: 'PT5M', keywords: article.keywords, author: { '@type': 'Person', name: article.author.name, url: article.author.url }, publisher: { '@type': 'Organization', name: 'Omni AI', url: origin, logo: { '@type': 'ImageObject', url: `${origin}/favicon.png` }, sameAs: ['https://www.linkedin.com/company/omni-ai', 'https://x.com/SitaniMafi'] }, image: { '@type': 'ImageObject', url: image, width: 1664, height: 936, caption: 'AI-generated conceptual editorial artwork with seven blank illustrative profiles; not a documented family genealogy.' }, citation: article.sources.map(source => source.url), isBasedOn: { '@type': 'CreativeWork', name: 'AIS Empire — originating essay', url: 'https://aisempire.org/newsletter/what-is-a-legacy-brand' } },
    { '@type': 'FAQPage', mainEntity: article.faq.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
  ] };
  return <><NewsletterHeader /><main id="main" className="legacy-brand-story">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
    <nav className="legacy-omni-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/newsletter/archive">Archive</Link><span>/</span><span>Legacy branding</span></nav>
    <article>
      <header className="legacy-omni-article-header legacy-article-header"><p className="legacy-omni-kicker">Perspective · Family legacy</p><h1>{article.title}</h1><p className="legacy-omni-article-deck">{article.description}</p><p className="legacy-article-credits"><span>Source <a href={article.source.url}>{article.source.name}</a></span><span>By <a className="legacy-article-author" href={article.author.url}>{article.author.name}</a></span><time dateTime={article.date}>November 13, 2026</time><span>{minutes} min read</span></p><details className="legacy-article-tags"><summary>Topics <span aria-hidden="true">⌄</span></summary><ul>{article.keywords.map(tag => <li key={tag}>{tag}</li>)}</ul></details></header>
      <div className="legacy-omni-article-figure legacy-article-hero"><FamilyLegacyHero alt={imageAlt}/></div>
      <div className="legacy-omni-article-body legacy-article-prose">
        <div className="legacy-article-intro">{article.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
        {article.sections.map((section, index) => <section id={section.id} key={section.id}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph, paragraphIndex) => <Fragment key={paragraph}>
          <p>{paragraph}</p>
          {section.id === article.interactions.retelling.afterSectionId && paragraphIndex === 1 ? <LegacyRetelling data={article.interactions.retelling}/> : null}
        </Fragment>)}
        {section.id === article.interactions.principles.afterSectionId ? <LegacyPrinciples data={article.interactions.principles}/> : null}
        {section.id === article.interactions.reflection.afterSectionId ? <LegacyReflection data={article.interactions.reflection}/> : null}
        {index === 2 ? <LegacyArticleShare title={article.title} url={url}/> : null}</section>)}
        <section className="legacy-article-faq"><h2>Questions worth asking</h2>{article.faq.map(item => <div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</section>
        <aside className="legacy-article-cta"><p className="legacy-omni-kicker">Your next step</p><h2>Give the next generation more than a name.</h2><p>Start with the lesson you would refuse to let disappear. Discuss how to give its story and context a home your family can find.</p><a className="legacy-omni-button legacy-omni-button-gold" href="/book-now">Start today <span aria-hidden="true">↗</span></a></aside>
        <details className="legacy-article-sources"><summary>Sources &amp; reading notes <span aria-hidden="true">⌄</span></summary><p>This is an authored perspective. The historical reference provides context; the related network essays are not independent corroborating studies.</p><ul>{article.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a><p>{source.note}</p></li>)}</ul></details>
      </div>
    </article>
    <section className="legacy-omni-section legacy-article-related" aria-labelledby="legacy-related-title"><div className="legacy-omni-section-head"><div><p className="legacy-omni-kicker">Family decisions · Related reading</p><h2 id="legacy-related-title">More to consider.</h2></div></div><div className="legacy-omni-story-grid">{related.map(post => <NewsletterIssueCard key={post.slug} post={post} />)}</div></section>
    <div className="legacy-article-archive"><Link className="legacy-omni-button" href="/newsletter/archive">View full archive <span aria-hidden="true">↗</span></Link></div>
  </main><Footer /></>;
}
