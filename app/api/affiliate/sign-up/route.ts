import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const OWNER_EMAIL = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Omni AI <bookings@omnileadsagi.com>';

export async function POST(request: Request) {
  try {
    const { name, email, phone, audience } = await request.json();

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sb = createAdminClient();
    const { error } = await sb.from('affiliate_signups').insert({
      name,
      email,
      phone,
      audience: audience || null,
      created_at: new Date().toISOString(),
    });

    if (error && error.code !== '42P01') {
      console.error('[affiliate/sign-up] DB insert error:', error);
    }

    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [OWNER_EMAIL],
          subject: `New affiliate signup: ${name}`,
          html: `<h2>New affiliate signup</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Phone:</strong> ${phone}</p>
<p><strong>Audience:</strong> ${audience || '—'}</p>`,
        }),
      }).catch((e) => console.error('[affiliate/sign-up] Email error:', e));
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
