import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('webinar_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching webinar registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Transform camelCase form fields to snake_case DB columns
    const row = {
      first_name: body.firstName || body.first_name || '',
      last_name: body.lastName || body.last_name || '',
      email: body.email || '',
      phone: body.phone || '',
      session_date: body.sessionDate || body.session_date || '',
      session_time: body.sessionTime || body.session_time || '',
    };

    const { data, error } = await supabase
      .from('webinar_registrations')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating webinar registration:', error);
    return NextResponse.json({ error: 'Failed to create registration' }, { status: 500 });
  }
}
