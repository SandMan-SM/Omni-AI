import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('id, email, first_name, subscription_tier, subscribed, subscribed_at, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ subscribers: data || [], total: (data || []).length });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, first_name, subscription_tier = 'subscribed' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert([{ email, first_name: first_name || null, subscription_tier, subscribed: true }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ subscriber: data }, { status: 201 });
  } catch (error) {
    console.error('Error adding subscriber:', error);
    return NextResponse.json({ error: 'Failed to add subscriber' }, { status: 500 });
  }
}
