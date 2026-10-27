import { NextResponse } from "next/server";

// The bare `/interlinked/developer` URL is the share-friendly link people
// type; the actual landing lives at `/interlinked/developer/info`. Without
// this the bare URL 404'd.
//
// This is a route handler rather than a page: a page-level `redirect()` in
// the App Router is emitted as a prerendered **200** carrying a
// `<meta http-equiv="refresh">` tag, so a crawler reads a 200 for a page
// with no content — the same soft-404 defect that `/auth` had. A handler
// answers with a real 308 and a `Location` header, which is what a
// permanent alias should look like.
//
// The query string is carried across so a shared link's UTM parameters
// survive the hop.
//
// `/interlinked/developer/info` is a separate segment and is unaffected:
// a route handler and a page can coexist in different segments of the tree.

export const dynamic = "force-dynamic";

function redirectTo(request: Request): NextResponse {
  const target = new URL("/interlinked/developer/info", request.url);
  const incoming = new URL(request.url);
  target.search = incoming.search;
  return NextResponse.redirect(target, 308);
}

export function GET(request: Request): NextResponse {
  return redirectTo(request);
}

// A HEAD request must answer with the same status and headers as GET but no
// body, so crawlers and link checkers that probe with HEAD are not handed a
// 405 for a route that plainly exists.
export function HEAD(request: Request): NextResponse {
  return redirectTo(request);
}
