// Loading skeleton for /[slug] — the single largest traffic surface
// on the site (daily trending landing pages tweet-linked via Blotato).
// Previously a cold Supabase read or Vercel cold start showed a blank
// white flash during navigation. Matching the landing page's purple-glow
// palette keeps the transition continuous so the visitor perceives the
// site as already-there while the DB fetch completes.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-hidden flex items-center justify-center">
      {/* Same single-glow treatment as app/[slug]/page.tsx — keeps the
          CLAUDE.md single-purple-glow rule intact during the loading
          state so we don't flash a different look before content. */}
      <div
        className="absolute rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{
          width: 700,
          height: 700,
          background: "radial-gradient(circle, #6366f1, transparent 70%)",
          top: -200,
          left: -200,
        }}
      />
      <div className="relative flex flex-col items-center gap-5">
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm uppercase tracking-widest">
          Loading
        </p>
      </div>
    </div>
  );
}
