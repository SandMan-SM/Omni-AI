# Omni AI - Login System Fixes

## Current state (2026-11-09) — read this before copying any pattern below

The snippet below is **history**. It describes a client that called the
Supabase `auth-login` edge function directly. **This repo's client does not
do that any more**: since commit `1c852963` (2026-10-28) it authenticates
against the Next.js route **`POST /api/auth/login`**, which reads the
credential with the server-side Postgres pool and mints the session with
`signOmniToken` (`lib/server/omni-session-token.ts`).

Two things changed with it, and both matter:

- **The token is SIGNED**, not base64-encoded. It is
  `omni1.<payload>.<HMAC-SHA256>`, and the server verifies the signature
  before it trusts any claim in it — including `is_admin`. A bearer that
  is only base64-encoded is not a credential: anybody can write
  `btoa(JSON.stringify({ is_admin: true }))` and be admitted as an admin by
  a server that merely decodes it. `npm run audit:credential-verification`
  fails the build on either half.
- **The edge function is a FALLBACK, not a path.** The edge function
  (`supabase/functions/auth-login/`) is one shared endpoint on a shared
  Supabase project, and it is still consumed as a fallback by other
  surfaces in the portfolio. It mints signed tokens too, but a surface that
  **decodes a raw bearer** would reject them — so a new surface should use
  its own `/api/auth/login` route rather than adding another consumer of
  the shared mint.

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
