# Omni AI - Login System Fixes

## Issue: Login failing with 401 error (Next.js App Router version)

**Root Cause:** The edge function call was missing the Supabase API key in the request headers.

**Fix in `/lib/auth.ts` (app directory version):**

```typescript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auth-login`;

// In the login function:
const res = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY
  },
  body: JSON.stringify({ username, password }),
});
```

**Note:** The `/client` version uses Supabase's built-in auth (`signInWithPassword`) and does NOT need this fix. Only the Next.js App Router version (`/app`) using custom edge functions needs the API key headers.

**Always include both when calling edge functions from client:**
- `Authorization: Bearer ${SUPABASE_ANON_KEY}`
- `apikey: ${SUPABASE_ANON_KEY}`
