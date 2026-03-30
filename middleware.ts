import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const protectedRoutes = ['/dashboard', '/admin'];
const adminOnlyRoutes = ['/admin'];
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

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
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

  // Fire-and-forget page_view event for authenticated users on key pages
  // Uses fetch to /api endpoint to avoid importing heavy deps in middleware
  const trackablePages = ['/dashboard', '/admin', '/newsletter', '/sponsor', '/interlinked'];
  if (trackablePages.some(p => pathname.startsWith(p))) {
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/events/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor_type: 'user',
        actor_id: user.id,
        event_type: 'page_view',
        event_category: 'navigation',
        action: 'view',
        page_url: pathname,
        user_agent: request.headers.get('user-agent') || '',
      }),
    }).catch(() => {}); // fire-and-forget
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
