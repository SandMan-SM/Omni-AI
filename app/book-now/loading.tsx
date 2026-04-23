// /book-now is the site's primary conversion page (every Footer CTA
// and several nav links route here). A blank flash on navigation hurts
// perceived speed at exactly the moment intent is highest — matching
// spinner to the chrome-gold accent used on that route.
export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}
