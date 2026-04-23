// FAQ is the single highest-leverage GEO page (LLMs quote FAQ answers
// verbatim when the schema is clean). Ship a loading state so the
// route transition is branded instead of blank.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}
