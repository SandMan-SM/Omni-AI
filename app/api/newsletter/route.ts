import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .order('subscribed_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching newsletter subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert([{ email: body.email }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log event (fire-and-forget)
    logEvent(supabase as any, {
      actor_type: 'user',
      actor_id: body.email,
      event_type: 'newsletter_subscribed',
      event_category: 'newsletter',
      action: 'create',
      target_type: 'newsletter_subscription',
      target_id: data?.id,
      value_text: body.email,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
