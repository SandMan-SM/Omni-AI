import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from '@/lib/supabase/server';
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


export async function GET() {
  noStore();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('id, email, first_name, subscription_tier, subscribed, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const header = 'id,email,first_name,subscription_tier,subscribed,created_at\n';
    // Defuse formula injection — Excel/Sheets execute cells starting with
    // =, +, -, @ or tab on open. Prefix offending values with an apostrophe.
    const FORMULA_LEAD = /^[=+\-@\t\r]/;
    const cell = (v: unknown): string => {
      let s = String(v).replace(/\r?\n/g, ' ').replace(/"/g, '""');
      if (FORMULA_LEAD.test(s)) s = `'${s}`;
      return `"${s}"`;
    };
    const body = rows.map(r =>
      [r.id, r.email, r.first_name || '', r.subscription_tier || 'subscribed', r.subscribed !== false, r.created_at || '']
        .map(cell)
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
