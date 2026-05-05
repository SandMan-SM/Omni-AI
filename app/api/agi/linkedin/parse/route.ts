import { NextRequest, NextResponse } from 'next/server';

// Parse a LinkedIn URL into structured fields.
// LinkedIn blocks server-side scraping aggressively, so this just extracts
// what we can from the URL itself + canonicalizes it.
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

    // Hostname-pinned SSRF guard. The original regex match only required
    // the substring `linkedin.com/in/` somewhere in the URL, so an attacker
    // could pass `http://internal-host/?path=linkedin.com/in/foo` and the
    // server would still hit that internal host with the fetch below.
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Only http(s) URLs allowed' }, { status: 400 });
    }
    const hostOk = parsed.hostname === 'linkedin.com' || parsed.hostname === 'www.linkedin.com';
    if (!hostOk) {
      return NextResponse.json({ error: 'Not a LinkedIn URL' }, { status: 400 });
    }

    // Extract slug from /in/<slug>
    const m = parsed.pathname.match(/^\/in\/([a-zA-Z0-9-]+)/);
    const slug = m?.[1] ?? null;

    if (!slug) {
      return NextResponse.json({ error: 'Not a LinkedIn personal profile URL' }, { status: 400 });
    }

    // Best-effort name guess from slug (split on dashes, title-case)
    const nameGuess = slug.split('-')
      .filter((p: string) => !/^\d+$/.test(p))
      .map((p: string) => p[0]?.toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');

    // Try to fetch og:title (LinkedIn often returns "Name | LinkedIn" in og tags)
    let scrapedName: string | null = null;
    let scrapedTitle: string | null = null;
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmniLeadsAGI/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const html = await r.text();
        const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1];
        const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1];
        if (ogTitle) {
          scrapedName = ogTitle.split('|')[0].trim();
          scrapedTitle = ogDesc?.split('·')[0]?.trim() ?? null;
        }
      }
    } catch { /* swallow */ }

    return NextResponse.json({
      ok: true,
      url,
      slug,
      name_guess: nameGuess,
      scraped_name: scrapedName,
      scraped_title: scrapedTitle,
      // Suggestion to use: prefer scraped, fall back to slug guess
      suggested: {
        first_name: (scrapedName ?? nameGuess).split(' ')[0],
        last_name: (scrapedName ?? nameGuess).split(' ').slice(1).join(' '),
        title: scrapedTitle,
        linkedin_url: url,
      },
    });
  } catch (err) {
    console.error('[linkedin/parse]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
