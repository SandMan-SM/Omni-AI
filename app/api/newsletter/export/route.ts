import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('id, email, first_name, subscription_tier, subscribed, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const header = 'id,email,first_name,subscription_tier,subscribed,created_at\n';
    const body = rows.map(r =>
      [r.id, r.email, r.first_name || '', r.subscription_tier || 'subscribed', r.subscribed !== false, r.created_at || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(header + body, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="omni_newsletter_${date}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
