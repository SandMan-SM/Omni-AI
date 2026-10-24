import { NextResponse } from "next/server";

// The sign-in surface is /login. A bare /auth link used to land on the
// global not-found page, which Next.js serves with a 200 status — a soft
// 404 that reads as a broken page to a crawler and to a customer who
// clicked "Sign in". Redirecting keeps any external reference working.
//
// This is a route handler rather than a page: a page-level `redirect()` in
// the App Router is emitted as a prerendered 200 with a
// `<meta http-equiv="refresh">` tag, so crawlers still read a 200 for a
// page with no content. A handler answers with a real 308 and a Location
// header, which is what a permanent alias should look like.
//
// /auth/callback remains a route handler in this directory; route handlers
// at different segments of the same tree coexist.

export const dynamic = "force-dynamic";

export function GET(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/login", request.url), 308);
}

// A HEAD request must answer with the same status and headers as GET but no
// body, so crawlers and link checkers that probe with HEAD are not handed a
// 405 for a route that plainly exists.
export function HEAD(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/login", request.url), 308);
}
