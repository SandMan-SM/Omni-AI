import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isValidEmail,
  isBotSubmission,
  sanitizeText,
} from '@/lib/validation';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { notifyOwnerEmail, notifyOwnerTelegram } from '@/lib/cps-notify';

/**
 * CPS lead intake. Called by the CPS contact form, newsletter signup,
 * and any other lead-capture surface on psychandcustodyevaluations.com.
 *
 * Writes to cps_leads (separate table — no mixing with omnileads leads),
 * then fans out to email (Resend → alfred@omnileadsagi.com) AND Telegram
 * (already wired, lands on the owner's phone via the Telegram app).
 *
 * Rate-limited at 5/10-min per IP — looser than omnileads's 3/10-min
 * because the CPS site has multiple lead surfaces (contact, newsletter,
 * service pages) so a single user might submit twice in one session.
 */

const ALLOWED_ORIGINS = new Set([
  'https://psychandcustodyevaluations.com',
  'https://www.psychandcustodyevaluations.com',
  'https://cps-website-nine.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
]);

function corsHeaders(origin: string | null): HeadersInit {
  const ok = origin && ALLOWED_ORIGINS.has(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'https://psychandcustodyevaluations.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin);

  try {
    const ip = getClientIp(request.headers);
    const rl = rateLimit(`cps-leads:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.ok) {
      const r = rateLimitResponse(rl.resetMs);
      Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v as string));
      return r;
    }

    const body = await request.json().catch(() => ({}));

    if (isBotSubmission(body)) {
      // Silent success so spammers don't tune their probes.
      return NextResponse.json({ ok: true }, { headers: cors });
    }

    const name = sanitizeText(body.name, 200);
    const email = sanitizeText(body.email, 254).toLowerCase();
    const phone = sanitizeText(body.phone, 50);
    const message = sanitizeText(body.message, 4000);
    const source = sanitizeText(body.source, 50) || 'contact_form';

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required.' },
        { status: 400, headers: cors },
      );
    }

    // Email validation only if provided. Phone-only and message-only leads
    // are valid (e.g. callback requests, anonymous newsletter signups
    // would still have email — but a contact form might be phone-only).
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400, headers: cors },
      );
    }
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone is required.' },
        { status: 400, headers: cors },
      );
    }

    const pageUrl = sanitizeText(body.page_url, 2048);
    let pagePath: string | null = null;
    try {
      if (pageUrl) pagePath = new URL(pageUrl, 'https://psychandcustodyevaluations.com').pathname;
    } catch {
      pagePath = null;
    }

    const sb = createAdminClient();
    const { data: inserted, error: insertError } = await sb
      .from('cps_leads')
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        message: message || null,
        source,
        page_url: pageUrl || null,
        page_path: pagePath,
        visitor_id: sanitizeText(body.visitor_id, 100) || null,
        session_id: sanitizeText(body.session_id, 100) || null,
        utm_source: sanitizeText(body.utm_source, 100) || null,
        utm_medium: sanitizeText(body.utm_medium, 100) || null,
        utm_campaign: sanitizeText(body.utm_campaign, 100) || null,
        referrer: sanitizeText(body.referrer, 2048) || null,
        ip_address: ip,
        user_agent: sanitizeText(body.user_agent, 500) || null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[cps/leads] insert error:', insertError);
      return NextResponse.json(
        { error: "We couldn't save your submission. Please try again." },
        { status: 500, headers: cors },
      );
    }

    // Fan-out notify. Both are best-effort — failure to notify must not
    // break the response, the lead is already persisted.
    const lead = {
      id: inserted.id as string,
      name,
      email: email || null,
      phone: phone || null,
      message: message || null,
      source,
      pageUrl: pageUrl || null,
    };

    const [emailOk, telegramOk] = await Promise.all([
      notifyOwnerEmail(lead).catch((e) => {
        console.error('[cps/leads] email notify failed', e);
        return false;
      }),
      notifyOwnerTelegram(lead).catch((e) => {
        console.error('[cps/leads] telegram notify failed', e);
        return false;
      }),
    ]);

    // Audit the channels that succeeded so the dashboard can flag
    // notification gaps (e.g. Telegram bot offline) without polling.
    if (emailOk || telegramOk) {
      await sb
        .from('cps_leads')
        .update({ email_notified: emailOk, telegram_notified: telegramOk })
        .eq('id', lead.id);
    }

    return NextResponse.json({ ok: true, id: lead.id }, { headers: cors });
  } catch (e) {
    console.error('[cps/leads] failed:', e);
    return NextResponse.json({ ok: false }, { status: 500, headers: cors });
  }
}
