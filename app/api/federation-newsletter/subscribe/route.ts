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
  const unsubUrl = buildUnsubscribeUrl(
    email,
    `https://omnileadsagi.com`,
  );
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">
      <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">
        Welcome to ${brandName}
      </p>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">You're on the list.</h1>
      <p style="font-size:15px;line-height:1.6">
        ${cadence}
        No spam, no resharing — and you can unsubscribe in one click any
        time via the link at the bottom of every email.
      </p>
      <p style="font-size:13px;color:#666;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
        Sent from <a href="https://${siteDomain}" style="color:#d4af37">${siteDomain}</a> ·
        <a href="${unsubUrl}" style="color:#888">unsubscribe</a>
      </p>
    </div>
  `;
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
        subject: `Welcome to ${brandName}`,
        html,
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
      ? 'Your weekly Utah Main Street dispatch arrives on Mondays.'
      : 'New dispatches will arrive as soon as the next issue is published.';
  void sendWelcomeEmail(email, brief.brandName, fromEmail, brief.domain, cadence);

  return withCors(NextResponse.json({ ok: true }));
}
