import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('waitlist_entries')
      .insert([body])
      .select()
      .single();

    if (error) {
      // Log the raw Supabase error (schema, constraint, hint) server-side
      // only. Returning error.message leaks DB structure to attackers who
      // can probe edge-cases.
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: "We couldn't add you to the waitlist. Please try again." },
        { status: 400 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating waitlist entry:', error);
    return NextResponse.json({ error: 'Failed to create waitlist entry' }, { status: 500 });
  }
}
