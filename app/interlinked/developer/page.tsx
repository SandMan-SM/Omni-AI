import { redirect } from "next/navigation";

// Bare /interlinked/developer URL was 404'ing. The actual landing
// lives at /interlinked/developer/info — share-friendly link that
// people type without the trailing /info gets a clean 308 redirect
// instead of hitting the global not-found page.
//
// Why a server-side redirect (not a Next.js rewrite or a metadata
// refresh): preserves search engine ranking on the canonical URL
// and avoids a flash of any client-side state. This is the
// idiomatic App Router pattern for "route exists conceptually but
// content lives one segment deeper."

export default function InterlinkedDeveloperRedirect(): never {
  redirect("/interlinked/developer/info");
}
