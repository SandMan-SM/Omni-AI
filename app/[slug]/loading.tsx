// Loading skeleton for /[slug] — the single largest traffic surface
// on the site (daily trending landing pages tweet-linked via Blotato).
// Previously a cold Supabase read or Vercel cold start showed a blank
// white flash during navigation. Transparent bg so the root layout's
// SpaceBackdrop drifts behind the spinner — identical treatment to
// the actual page so the transition into rendered content is
// continuous (no bg color flash between loading → rendered).
export default function Loading() {
  return (
    <div className="min-h-screen text-white overflow-hidden flex items-center justify-center relative">
      <div className="relative flex flex-col items-center gap-5">
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm uppercase tracking-widest">
          Loading
        </p>
      </div>
    </div>
  );
}
