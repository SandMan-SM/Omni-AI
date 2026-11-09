import test from 'node:test';
import assert from 'node:assert/strict';
import { newsletterSourceLinks, generalNewsSections } from '../lib/newsletter-source-links';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewsletterSourceText } from '../components/newsletter/source-text';
import { newsletterShareDescription } from '../lib/newsletter-share-copy';

test('source links preserve text and support multiple real HTTPS citations', () => {
  const parts = newsletterSourceLinks('Confirmed. [Board](https://investor.nvidia.com/statement/), [Message](https://nvidianews.nvidia.com/message).');
  assert.deepEqual(parts, [
    { text: 'Confirmed. ', href: null }, { text: 'Board', href: 'https://investor.nvidia.com/statement/' },
    { text: ', ', href: null }, { text: 'Message', href: 'https://nvidianews.nvidia.com/message' }, { text: '.', href: null },
  ]);
  assert.deepEqual(newsletterSourceLinks('Unchanged plain text.'), [{ text: 'Unchanged plain text.', href: null }]);
});
test('untrusted HTML and unsupported link protocols remain literal text; embedded credentials are rejected', () => {
  for (const text of ['<script>alert(1)</script>', '[bad](javascript:alert(1))', '[bad](data:text/html,test)',
    '[bad](http://example.com/)', '[bad](https://user:secret@example.com/)', '[bad](https://example.com/<script>)']) {
    assert.deepEqual(newsletterSourceLinks(text), [{ text, href: null }]);
  }
  const text = '[bad](https://user:secret@example.com/) followed by [good](https://example.com/).';
  assert.equal(newsletterSourceLinks(text)[0].text, '[bad](https://user:secret@example.com/) followed by ');
  assert.equal(newsletterSourceLinks(text)[1].href, 'https://example.com/');
});
test('General News retains authored section headings and paragraph boundaries without inventing copy', () => {
  assert.deepEqual(generalNewsSections([{ heading: 'What is confirmed', body: 'First paragraph.\n\nSecond paragraph.' },
    'A plain section.', { heading: 'Empty', body: '' }, null]), [
    { heading: 'What is confirmed', paragraphs: ['First paragraph.', 'Second paragraph.'] },
    { heading: null, paragraphs: ['A plain section.'] },
  ]);
});
test('the source component renders real anchors and escapes HTML in labels and surrounding text', () => {
  const html = renderToStaticMarkup(createElement(NewsletterSourceText, {
    text: '<img src=x onerror=alert(1)> [<script>bad</script>](https://example.com/source)',
  }));
  assert.match(html, /href="https:\/\/example.com\/source"/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img|<script/);
});
test('General News share descriptions preserve factual copy and readable source labels', () => {
  assert.equal(newsletterShareDescription({ day_type: 'general-news', intro: 'The board opened a review. [Statement](https://example.com/source).' }),
    'The board opened a review. Statement.');
});
