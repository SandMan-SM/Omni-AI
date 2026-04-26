import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function authorized(req: NextRequest): boolean {
  if (!process.env.ADMIN_API_KEY) return true;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.ADMIN_API_KEY}`;
}

// System config CRUD
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('omni_system_config').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Convert to flat object
  const config: Record<string, unknown> = {};
  for (const row of data ?? []) config[row.key] = row.value;
  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  const { error } = await supabase
    .from('omni_system_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
