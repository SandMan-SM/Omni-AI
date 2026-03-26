import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
    }

    const rawHeaders = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    const emailIdx = rawHeaders.indexOf('email');
    const nameIdx = rawHeaders.indexOf('first_name') !== -1 ? rawHeaders.indexOf('first_name') : rawHeaders.indexOf('name');
    const tierIdx = rawHeaders.indexOf('subscription_tier') !== -1 ? rawHeaders.indexOf('subscription_tier') : rawHeaders.indexOf('tier');

    if (emailIdx === -1) {
      return NextResponse.json({ error: 'CSV must have an "email" column' }, { status: 400 });
    }

    const supabase = await createClient();
    let added = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parse (handles basic quoting)
      const cols = lines[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
      const email = cols[emailIdx]?.toLowerCase();
      if (!email) { skipped++; continue; }

      const first_name = nameIdx !== -1 ? (cols[nameIdx] || null) : null;
      const subscription_tier = tierIdx !== -1 ? (cols[tierIdx] || 'subscribed') : 'subscribed';

      const { error } = await supabase
        .from('newsletter_subscriptions')
        .upsert({ email, first_name, subscription_tier, subscribed: true }, { onConflict: 'email', ignoreDuplicates: false });

      if (error) { skipped++; } else { added++; }
    }

    return NextResponse.json({ added, skipped });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
