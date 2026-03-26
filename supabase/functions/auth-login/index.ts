import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find user by username
    const { data: user, error: userError } = await supabase
      .from('user_credentials')
      .select('*')
      .eq('username', username)
      .single()

    if (userError) {
      console.error('User lookup error:', userError);
      return new Response(JSON.stringify({ error: 'DB error: ' + userError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found: ' + username }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify password
    if (password !== user.password_hash) {
      return new Response(JSON.stringify({ error: 'Wrong password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get or create profile
    let profileId = user.profile_id;
    let profile = null;
    
    if (profileId) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()
      profile = existingProfile;
    }
    
    const isFray = username.toLowerCase() === 'fray';
    const isCPS = username.toLowerCase() === 'cps';
    const isMafi = username.toLowerCase() === '$mafi';
    
    if (!profile) {
      // Create new profile
      profileId = crypto.randomUUID();
      
      if (isCPS) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: profileId,
            email: 'cps@example.com',
            username: username,
            is_admin: false,
            is_sponsor: false,
            role: 'user',
            sponsor_tier: null,
            tier: 2,
            sponsor_activated: false,
            sponsor_insights_paid: false
          })
          .select()
          .single()
        profile = newProfile;
      } else if (isFray) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: profileId,
            email: 'fray1959@gmail.com',
            username: username,
            is_admin: false,
            is_sponsor: true,
            role: 'sponsor',
            sponsor_tier: 'vip',
            tier: 3,
            sponsor_activated: true,
            sponsor_insights_paid: true
          })
          .select()
          .single()
        profile = newProfile;
      } else {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: profileId,
            email: `${username.toLowerCase()}@example.com`,
            username: username,
            is_admin: false,
            is_sponsor: false,
            role: 'user',
            sponsor_tier: null,
            tier: 0,
            sponsor_activated: false,
            sponsor_insights_paid: false
          })
          .select()
          .single()
        profile = newProfile;
      }
    } else {
      // Update existing profile
      if (isFray) {
        await supabase.from('profiles').update({
          email: 'fray1959@gmail.com',
          is_sponsor: true,
          role: 'sponsor',
          sponsor_tier: 'vip',
          tier: 3,
          sponsor_activated: true,
          sponsor_insights_paid: true
        }).eq('id', profileId);
      } else if (isCPS) {
        await supabase.from('profiles').update({
          is_sponsor: false,
          role: 'user',
          sponsor_tier: null,
          tier: 1, // Master tier
          sponsor_activated: false,
          sponsor_insights_paid: false
        }).eq('id', profileId);
      } else if (isMafi) {
        await supabase.from('profiles').update({
          is_admin: true,
          role: 'admin'
        }).eq('id', profileId);
      }
    }

    // Create token
    const tier = isFray ? 3 : (isCPS ? 1 : (profile?.tier ?? 0));
    const tierName = isFray ? 'VIP Sponsor' : (isCPS ? 'Master' : (tier === 3 ? 'Empire' : tier === 2 ? 'Royal' : tier === 1 ? 'Master' : 'Apprentice'));
    const isAdmin = isMafi || profile?.is_admin === true;
    
    const tokenData = {
      sub: profileId,
      username: username,
      tier: tier,
      tier_name: tierName,
      is_admin: isAdmin,
      is_sponsor: isFray,
      sponsor_tier: isFray ? 'VIP Sponsor' : null,
      sponsor_activated: isFray ? true : false,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    }
    
    const token = btoa(JSON.stringify(tokenData))

    const userEmail = isFray ? 'fray1959@gmail.com' : (profile?.email || `${username.toLowerCase()}@example.com`);

    return new Response(JSON.stringify({
      access_token: token,
      user: {
        id: profileId,
        username: username,
        email: userEmail,
        tier: tier,
        tier_name: tierName,
        is_admin: isAdmin,
        is_sponsor: isFray,
        sponsor_tier: isFray ? 'VIP Sponsor' : null,
        sponsor_activated: isFray ? true : false
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
