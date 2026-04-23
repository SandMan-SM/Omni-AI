import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/newsletter/analytics
 *
 * Fetches real-time email analytics from the Resend API:
 * - Per-email delivery status (sent, delivered, opened, clicked, bounced, complained)
 * - Aggregate stats (total, delivered, opened, clicked, bounced)
 * - Open rate and click rate percentages
 *
 * Security notes:
 *   - `force-dynamic`: without it, Next.js was statically prerendering this
 *     route at build time. That meant the response (which includes raw
 *     recipient email addresses in `emails[].to[]`) was cached into the
 *     build output and served to anyone who hit the URL. Forcing dynamic
 *     render makes each request go through the admin gate below.
 *   - `requireAdmin()`: this endpoint exposes subscriber emails + per-send
 *     delivery status. It was previously completely unauthed. Admin-only
 *     now.
 *
 * This is called by the admin dashboard + Fray dashboard to show live
 * newsletter performance. Both callers forward the omni_token bearer.
 */

export const dynamic = 'force-dynamic';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

interface ResendEmail {
  id: string;
  to: string[];
  from: string;
  subject: string;
  created_at: string;
  last_event: string;
  scheduled_at: string | null;
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Fetch all sent emails from Resend (max 100 per page)
    const res = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      next: { revalidate: 60 }, // cache for 60s
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend API error:', errText);
      return NextResponse.json({ error: 'Failed to fetch from Resend' }, { status: res.status });
    }

    const result = await res.json();
    const allEmails: ResendEmail[] = result.data || [];

    // Filter to only newsletter emails — exclude demo booking confirmations,
    // webinar registrations, and other transactional emails
    const NEWSLETTER_SENDERS = ['newsletter@omnileadsagi.com'];
    const TRANSACTIONAL_PREFIXES = ['Demo Confirmed', 'New Demo Booked', 'Training Session Confirmed', 'New Training Registration'];

    const emails = allEmails.filter(e => {
      // Only include newsletter-sender emails — exclude transactional / legacy
      if (!NEWSLETTER_SENDERS.some(s => e.from.includes(s))) return false;
      if (TRANSACTIONAL_PREFIXES.some(p => e.subject.startsWith(p))) return false;
      return true;
    });

    // Compute aggregate stats
    const total = emails.length;
    const delivered = emails.filter(e => ['delivered', 'opened', 'clicked'].includes(e.last_event)).length;
    const opened = emails.filter(e => ['opened', 'clicked'].includes(e.last_event)).length;
    const clicked = emails.filter(e => e.last_event === 'clicked').length;
    const bounced = emails.filter(e => e.last_event === 'bounced').length;
    const complained = emails.filter(e => e.last_event === 'complained').length;

    // Group by subject for per-newsletter analytics
    const bySubject = new Map<string, {
      subject: string;
      sent_at: string;
      from: string;
      total: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
    }>();

    for (const email of emails) {
      const key = email.subject;
      const existing = bySubject.get(key);
      if (existing) {
        existing.total++;
        if (['delivered', 'opened', 'clicked'].includes(email.last_event)) existing.delivered++;
        if (['opened', 'clicked'].includes(email.last_event)) existing.opened++;
        if (email.last_event === 'clicked') existing.clicked++;
        if (email.last_event === 'bounced') existing.bounced++;
      } else {
        bySubject.set(key, {
          subject: email.subject,
          sent_at: email.created_at,
          from: email.from,
          total: 1,
          delivered: ['delivered', 'opened', 'clicked'].includes(email.last_event) ? 1 : 0,
          opened: ['opened', 'clicked'].includes(email.last_event) ? 1 : 0,
          clicked: email.last_event === 'clicked' ? 1 : 0,
          bounced: email.last_event === 'bounced' ? 1 : 0,
        });
      }
    }

    // Sort by date descending
    const newsletters = Array.from(bySubject.values())
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    return NextResponse.json({
      // Aggregate
      summary: {
        total_sent: total,
        delivered,
        opened,
        clicked,
        bounced,
        complained,
        open_rate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        click_rate: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
      },
      // Per-newsletter breakdown
      newsletters,
      // Raw emails for detailed view
      emails: emails.map(e => ({
        id: e.id,
        to: e.to,
        from: e.from,
        subject: e.subject,
        status: e.last_event,
        sent_at: e.created_at,
      })),
    });
  } catch (err) {
    console.error('Newsletter analytics error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
