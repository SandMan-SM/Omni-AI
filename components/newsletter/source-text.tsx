import React, { Fragment } from 'react';
import { newsletterSourceLinks } from '@/lib/newsletter-source-links';

export function NewsletterSourceText({ text }: { text: string }) {
  return <>{newsletterSourceLinks(text).map((part, index) => part.href
    ? <a key={index} href={part.href} rel="noopener noreferrer" className="text-amber-200 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-100">{part.text}</a>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
