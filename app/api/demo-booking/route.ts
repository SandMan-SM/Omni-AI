import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch both demo bookings and webinar registrations
    const [bookingsRes, trainingsRes] = await Promise.all([
      supabase
        .from('demo_bookings')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('webinar_registrations')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (bookingsRes.error) throw bookingsRes.error;

    // Normalize demo bookings
    const bookings = (bookingsRes.data || []).map((b: any) => ({
      id: b.id,
      name: b.name || b.businessName || 'Demo',
      email: b.email,
      phone: b.phone || '',
      date: b.date,
      time: b.time,
      type: 'demo' as const,
      createdAt: b.created_at || b.createdAt,
    }));

    // Normalize webinar registrations as trainings
    const trainings = (trainingsRes.data || []).map((t: any) => ({
      id: t.id,
      name: `${t.firstName || t.first_name || ''} ${t.lastName || t.last_name || ''}`.trim() || 'Training',
      email: t.email,
      phone: t.phone || '',
      date: t.sessionDate || t.session_date || '',
      time: t.sessionTime || t.session_time || '',
      type: 'training' as const,
      createdAt: t.created_at || t.createdAt,
    }));

    // Merge and sort by date (upcoming first)
    const all = [...bookings, ...trainings].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`).getTime() || 0;
      const dateB = new Date(`${b.date} ${b.time}`).getTime() || 0;
      return dateA - dateB;
    });

    return NextResponse.json({ bookings: all });
  } catch (error) {
    console.error('Error fetching meetings & events:', error);
    return NextResponse.json({ bookings: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Transform camelCase form fields to snake_case DB columns
    const row = {
      name: body.name || '',
      phone: body.phone || '',
      email: body.email || '',
      business_name: body.businessName || body.business_name || '',
      purpose: body.purpose || '',
      date: body.date || '',
      time: body.time || '',
    };

    const { data, error } = await supabase
      .from('demo_bookings')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log event (fire-and-forget)
    logEvent(supabase as any, {
      actor_type: 'user',
      actor_id: body.email || 'anonymous',
      event_type: 'lead_created',
      event_category: 'crm',
      action: 'create',
      target_type: 'demo_booking',
      target_id: data?.id,
      value_text: body.businessName || body.business_name || body.name || '',
      properties: { email: body.email, purpose: body.purpose },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating demo booking:', error);
    return NextResponse.json({ error: 'Failed to create demo booking' }, { status: 500 });
  }
}
