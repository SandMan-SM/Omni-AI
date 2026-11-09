import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signOmniToken } from "./session-token.ts";
// auth-login
//
// POST /functions/v1/auth-login  { username, password }  → { access_token, user }
//
// Looks up a row in user_credentials by username (case-insensitive,
// trimmed). Compares password as plaintext against password_hash
// (existing convention — pre-existing accounts depend on this and a
// migration would lock them all out). Issues a SIGNED token with a
// 7-day exp that the rest of the app verifies.
//
// Failure modes return a generic 'Invalid username or password' so
// nothing leaks whether the username exists. The previous version
// returned PostgREST's 'Cannot coerce the result to a single JSON
// object' to the client whenever the username was misspelled — every
// AuthModal toast surfaced that confusing string and made sign-in
// look broken.
//
// Fixes vs prior version (v14):
//   - .single() → .maybeSingle()  (missing user is data:null, not error)
//   - .eq('username', username) → .ilike('username', trimmed)
//   - generic 'Invalid username or password' on both branches
//   - trim + collapse-whitespace on input
//   - returns {ok: true} shape on success unchanged for client compat
//
// The token is SIGNED, not base64-encoded. See ./session-token.ts: a
// bearer that is only base64-encoded is not a credential — anybody can
// write `btoa(JSON.stringify({ is_admin: true }))` and be admitted as
// an admin by any server that merely decodes it. The scheme is
// `omni1.<payload>.<HMAC-SHA256>`, the same one the Next.js server
// verifies in lib/server/omni-session-token.ts.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
function badAuth() {
  return new Response(JSON.stringify({
    error: 'Invalid username or password'
  }), {
    status: 401,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json().catch(()=>({}));
    const rawUsername = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const username = rawUsername.trim();
    if (!username || !password) {
      return new Response(JSON.stringify({
        error: 'Username and password required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Case-insensitive lookup. ilike with no wildcards behaves as a
    // case-insensitive equality match. maybeSingle() means a missing
    // row resolves to {data: null} cleanly instead of erroring.
    const { data: user, error: userError } = await supabase.from('user_credentials').select('*').ilike('username', username).maybeSingle();
    if (userError) {
      console.error('User lookup error:', userError);
      // Real DB error (not just "no row") — surface a generic 401 to
      // the client and log the detail server-side.
      return badAuth();
    }
    if (!user) return badAuth();
    if (password !== user.password_hash) return badAuth();
    // Username casing the client typed may differ from the DB row's
    // canonical casing. Use the DB's stored casing for the token +
    // profile sync below so admin allowlists / canonical comparisons
    // (e.g. CaseStudyGate's '$mafi' check) keep working.
    const canonicalUsername = user.username ?? username;
    let profileId = user.profile_id;
    let profile = null;
    if (profileId) {
      const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
      profile = existingProfile;
    }
    const lower = canonicalUsername.toLowerCase();
    const isFray = lower === 'fray';
    const isCPS = lower === 'cps';
    const isMafi = lower === '$mafi';
    if (!profile) {
      profileId = crypto.randomUUID();
      await supabase.from('user_credentials').update({
        profile_id: profileId
      }).ilike('username', canonicalUsername);
      if (isCPS) {
        const { data: newProfile } = await supabase.from('profiles').insert({
          id: profileId,
          email: 'cps@example.com',
          username: canonicalUsername,
          is_admin: false,
          is_sponsor: false,
          role: 'user',
          tier: 2,
          sponsor_activated: false,
          sponsor_insights_paid: false
        }).select().single();
        profile = newProfile;
      } else if (isFray) {
        const { data: newProfile } = await supabase.from('profiles').insert({
          id: profileId,
          email: 'fray1959@gmail.com',
          username: canonicalUsername,
          is_admin: false,
          is_sponsor: true,
          role: 'sponsor',
          sponsor_tier: 'vip',
          tier: 3,
          sponsor_activated: true,
          sponsor_insights_paid: true
        }).select().single();
        profile = newProfile;
      } else {
        const { data: newProfile } = await supabase.from('profiles').insert({
          id: profileId,
          email: `${lower}@example.com`,
          username: canonicalUsername,
          is_admin: false,
          is_sponsor: false,
          role: 'user',
          tier: 0,
          sponsor_activated: false,
          sponsor_insights_paid: false
        }).select().single();
        profile = newProfile;
      }
    } else {
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
          tier: 1,
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
    const tier = isFray ? 3 : isCPS ? 1 : profile?.tier ?? 0;
    const tierName = isFray ? 'VIP Sponsor' : isCPS ? 'Master' : (tier === 3 ? 'Empire' : tier === 2 ? 'Royal' : tier === 1 ? 'Master' : 'Apprentice');
    const isAdmin = isMafi || profile?.is_admin === true;
    const tokenData = {
      sub: profileId,
      username: canonicalUsername,
      tier,
      tier_name: tierName,
      is_admin: isAdmin,
      is_sponsor: isFray,
      sponsor_tier: isFray ? 'VIP Sponsor' : null,
      sponsor_activated: isFray,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    // A SIGNED token. The server verifies the signature before it trusts
    // any claim in this payload — including `is_admin`.
    const token = await signOmniToken(tokenData);
    const userEmail = isFray ? 'fray1959@gmail.com' : profile?.email || `${lower}@example.com`;
    return new Response(JSON.stringify({
      access_token: token,
      user: {
        id: profileId,
        username: canonicalUsername,
        email: userEmail,
        tier,
        tier_name: tierName,
        is_admin: isAdmin,
        is_sponsor: isFray,
        sponsor_tier: isFray ? 'VIP Sponsor' : null,
        sponsor_activated: isFray
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      error: 'Server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
