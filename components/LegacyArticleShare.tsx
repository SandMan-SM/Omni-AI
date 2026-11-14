'use client';

import { useState } from 'react';

export default function LegacyArticleShare({ title, url }: { title: string; url: string }) {
  const [message, setMessage] = useState('');
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setMessage('Article link copied.');
      } else {
        setMessage('Copy this article’s address from your browser to share it.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Could not share. Copy this article’s address from your browser.');
    }
  }
  return <div className="legacy-article-share"><button className="legacy-omni-button" type="button" onClick={share}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Share article</span></button><p role="status">{message}</p></div>;
}
