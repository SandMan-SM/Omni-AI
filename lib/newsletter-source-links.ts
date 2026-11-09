export type SourceTextPart = { text: string; href: string | null };

/** Inline source citations only. All other markup stays literal React text. */
export function newsletterSourceLinks(value: string): SourceTextPart[] {
  const parts: SourceTextPart[] = [];
  const pattern = /\[([^\]\n]{1,160})\]\((https:\/\/[^\s)<>{}]{1,2048})\)/g;
  let cursor = 0;
  for (const match of Array.from(value.matchAll(pattern))) {
    const index = match.index!;
    let href: string;
    try {
      const url = new URL(match[2]);
      if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || /[\u0000-\u001f\u007f]/.test(match[2])) continue;
      href = url.toString();
    } catch { continue; }
    if (index > cursor) parts.push({ text: value.slice(cursor, index), href: null });
    parts.push({ text: match[1], href });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), href: null });
  return parts;
}

export function generalNewsSections(value: unknown): { heading: string | null; paragraphs: string[] }[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap(entry => {
    const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
    const heading = record && typeof record.heading === 'string' ? record.heading.trim() : null;
    const body = typeof entry === 'string' ? entry : typeof record?.body === 'string' ? record.body
      : typeof record?.text === 'string' ? record.text : '';
    const paragraphs = body.split(/\n\s*\n+/).map(paragraph => paragraph.trim()).filter(Boolean);
    return paragraphs.length ? [{ heading: heading || null, paragraphs }] : [];
  });
}
