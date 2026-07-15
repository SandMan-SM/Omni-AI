import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getFederationBrief,
  FEDERATION_OPERATOR_EMAIL,
} from '@/lib/federation-newsletter-briefs';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Federation newsletter subscribe endpoint.
 *
 *   POST /api/federation-newsletter/subscribe
 *   { site: "<federation-slug>", email, first_name?, source? }
 *
 * Validates email shape + site, dedupes on (site, email) via the table's
 * unique constraint, writes to federation_newsletter_subscribers. Returns
 * { ok: true } on success or insert-after-conflict, { ok: false, error }
 * on validation failure.
 *
 * CORS is open so per-site signup forms can POST cross-origin without a
 * server-side proxy. The endpoint never echoes back any subscriber data —
 * pure write — so cross-origin POSTs can't be used to enumerate emails.
 *
 * Side effects: optionally pings the operator on Telegram with a "new
 * subscriber on <site>" notification so growth is visible in real time.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function isValidEmail(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  // Loose RFC-leaning check — enough to filter obvious garbage without
  // rejecting valid addresses with + tags, dots, or punycode domains.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}

async function sendWelcomeEmail(
  email: string,
  brandName: string,
  fromEmail: string,
  siteDomain: string,
  cadence: string,
): Promise<void> {
  if (!RESEND_API_KEY) return;
  const isUtahMainStreet = siteDomain === 'utahmainstreet.com';
  const siteUrl = `https://${siteDomain}`;
  const unsubUrl = buildUnsubscribeUrl(
    email,
    `https://omnileadsagi.com`,
  );
  const subject = isUtahMainStreet
    ? 'Welcome to Utah Main Street — your morning read starts here'
    : `Welcome to ${brandName}`;
  const preheader = isUtahMainStreet
    ? 'Source-backed Utah business stories, delivered each morning.'
    : `${cadence} No spam, no resharing.`;
  const headline = isUtahMainStreet ? "You're on Main Street now." : "You're on the list.";
  const intro = isUtahMainStreet
    ? 'Thanks for joining us. Each morning, we send one clear, source-backed look at a Utah operator, opening, shift, or local signal worth knowing.'
    : `${cadence} No spam, no resharing — just the stories and updates you asked for.`;
  const ctaHref = isUtahMainStreet ? `${siteUrl}/daily` : siteUrl;
  const ctaLabel = isUtahMainStreet ? "Read today's Daily Post" : `Visit ${brandName}`;
  const text = isUtahMainStreet
    ? [
        headline,
        '',
        intro,
        '',
        "What you'll get:",
        '• One useful Utah story each morning',
        '• Real names, places, sources, and public receipts',
        '• No paid placements inside editorial coverage',
        '',
        `${ctaLabel}: ${ctaHref}`,
        '',
        `You subscribed at ${siteDomain}. Unsubscribe anytime: ${unsubUrl}`,
      ].join('\n')
    : [
        headline,
        '',
        intro,
        '',
        `${ctaLabel}: ${ctaHref}`,
        '',
        `You subscribed at ${siteDomain}. Unsubscribe anytime: ${unsubUrl}`,
      ].join('\n');
  const expectations = isUtahMainStreet
    ? `<div style="margin:26px 0 0;padding:20px 22px;background:#f5f5f4;border:1px solid #d6d3d1;border-radius:6px;">
        <p style="margin:0 0 12px;color:#1f4d7a;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">What you'll get</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#292524;">One useful Utah story each morning.</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#292524;">Real names, places, sources, and public receipts.</p>
        <p style="margin:0;font-size:15px;line-height:1.55;color:#292524;">No paid placements inside editorial coverage.</p>
      </div>`
    : '';
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f0efec;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <div style="max-width:600px;margin:0 auto;padding:34px 18px;">
      <div style="background:#fafaf9;border:1px solid #d6d3d1;border-top:4px double #1c1917;padding:38px 38px 32px;">
        <p style="margin:0 0 18px;color:#1f4d7a;font-size:11px;font-weight:900;letter-spacing:2.6px;text-transform:uppercase;">${brandName} · Welcome</p>
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.08;color:#1c1917;">${headline}</h1>
        <p style="margin:20px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.65;color:#44403c;">${intro}</p>
        ${expectations}
        <p style="margin:28px 0 0;">
          <a href="${ctaHref}" style="display:inline-block;background:#1f4d7a;color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:13px 20px;border-radius:5px;">${ctaLabel}</a>
        </p>
        <p style="margin:32px 0 0;padding-top:18px;border-top:1px solid #d6d3d1;color:#78716c;font-size:12px;line-height:1.6;">
          You subscribed at <a href="${siteUrl}" style="color:#1f4d7a;">${siteDomain}</a>. You can
          <a href="${unsubUrl}" style="color:#78716c;">unsubscribe in one click</a> at any time.
        </p>
      </div>
    </div>
  </body></html>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${brandName} <${fromEmail}>`,
        to: [email],
        subject,
        html,
        text,
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    });
  } catch {
    /* welcome email failure is non-fatal */
  }
}

export async function POST(req: Request) {
  noStore();
  let body: { site?: unknown; email?: unknown; first_name?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return withCors(
      NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 }),
    );
  }

  const site =
    typeof body.site === 'string' ? body.site.trim().toLowerCase() : '';
  if (!site) {
    return withCors(
      NextResponse.json(
        { ok: false, error: 'site query param required' },
        { status: 400 },
      ),
    );
  }
  const brief = getFederationBrief(site);
  if (!brief) {
    return withCors(
      NextResponse.json(
        { ok: false, error: `unknown federation site: ${site}` },
        { status: 400 },
      ),
    );
  }

  if (!isValidEmail(body.email)) {
    return withCors(
      NextResponse.json({ ok: false, error: 'invalid email' }, { status: 400 }),
    );
  }
  const email = (body.email as string).trim().toLowerCase();
  const firstName =
    typeof body.first_name === 'string' && body.first_name.trim()
      ? body.first_name.trim().slice(0, 80)
      : null;
  const source =
    typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 40)
      : 'website';

  const sb = createAdminClient();
  // Upsert on (site, email). If the row exists and was previously
  // unsubscribed, flip unsubscribed back to false (user re-opted in).
  const { error: upsertErr } = await sb
    .from('federation_newsletter_subscribers')
    .upsert(
      {
        site,
        email,
        first_name: firstName,
        source,
        unsubscribed: false,
        unsubscribed_at: null,
      },
      { onConflict: 'site,email' },
    );
  if (upsertErr) {
    return withCors(
      NextResponse.json(
        { ok: false, error: upsertErr.message },
        { status: 500 },
      ),
    );
  }

  // Welcome email — fire-and-forget. Non-fatal if Resend fails.
  const fromEmail = brief.fromEmail ?? `dispatch@${brief.domain}`;
  const cadence =
    site === 'utah-main-street'
      ? 'Your Utah Main Street dispatch arrives each morning.'
      : 'New dispatches will arrive as soon as the next issue is published.';
  void sendWelcomeEmail(email, brief.brandName, fromEmail, brief.domain, cadence);

  return withCors(NextResponse.json({ ok: true }));
}
