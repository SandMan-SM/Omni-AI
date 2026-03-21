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

    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify password
    const passwordValid = crypto.subtle.timingSafeEqual(
      new TextEncoder().encode(password),
      new TextEncoder().encode(user.password_hash)
    )

    if (!passwordValid) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.profile_id)
      .single()

    // Create a custom token (simple JWT-like token)
    const tokenData = {
      sub: user.profile_id,
      username: username,
      tier: profile?.tier || 'free',
      is_admin: profile?.is_admin || false,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    }
    
    const token = btoa(JSON.stringify(tokenData))

    return new Response(JSON.stringify({
      access_token: token,
      user: {
        id: user.profile_id,
        username: username,
        email: profile?.email || '',
        tier: profile?.tier || 'free',
        is_admin: profile?.is_admin || false,
        is_sponsor: profile?.is_sponsor || false
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
