import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Neither /dashboard NOR /admin is in protectedRoutes any more.
//
// The middleware checks supabase.auth.getUser() (cookie session).
// The actual sign-in flow that ships in production goes through the
// `auth-login` Supabase edge function and stores a custom omni_token
// in localStorage — middleware can't see localStorage, so it always
// thought signed-in users were anonymous and redirected them to
// /?signin=true. That redirect was the entire post-signin loop on
// /dashboard, and it ALSO blocked signed-in admins from reaching
// /admin (Sita typed /admin and got bounced to the sign-in modal even
// though she was already signed in as $Mafi).
//
// Both /dashboard and every /admin/* page already do their own
// client-side auth check via useAuth().user + useProfile.isAdmin
// (redirects to '/' or '/dashboard' depending on role). Once the
// auth path is unified onto real Supabase cookie sessions we can
// put these back here.
const protectedRoutes: string[] = [];
const adminOnlyRoutes: string[] = [];
const publicRoutes = ['/', '/details', '/interlinked', '/campaigns', '/sponsor', '/join', '/arena'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next();
  }

  // Allow public routes. The `/` entry has to be matched exactly,
  // not via startsWith — every path starts with `/`, which previously
  // short-circuited the auth check on EVERY request including
  // /dashboard and /admin (Round-9 audit). startsWith works for the
  // others because they're path prefixes, not the bare slash.
  if (
    pathname === '/' ||
    publicRoutes
      .filter(r => r !== '/')
      .some(route => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return NextResponse.next();
  }

  // Check for protected routes
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAdminOnlyRoute = adminOnlyRoutes.some(route => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get user session
  const { data: { user }, error } = await supabase.auth.getUser();

  // No session - redirect to home
  if (!user || error) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('signin', 'true');
    return NextResponse.redirect(redirectUrl);
  }

  // For admin routes, check if user is admin
  if (isAdminOnlyRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.is_admin === true || profile?.role === 'admin';

    if (!isAdmin) {
      // Not admin - redirect to dashboard
      const redirectUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Add user info to headers for server components
  response.headers.set('x-user-id', user.id);
  response.headers.set('x-user-email', user.email || '');

  // NOTE: page_view tracking lives in <SiteTracker /> (app/layout.tsx) now.
  // The old fire-and-forget fetch from middleware (Edge runtime) was
  // silently dropping every event — confirmed by a 0-row page_view count
  // across 3+ weeks of live traffic. Keep this comment so nobody tries to
  // re-add it.

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
