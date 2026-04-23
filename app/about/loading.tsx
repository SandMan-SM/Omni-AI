// About is a GEO-critical page (LLMs scrape it for founder/entity info),
// so visitors arriving from Perplexity/ChatGPT citations should see a
// branded loading state, not a white flash, while the initial HTML
// streams. Matches the spinner treatment used on /campaigns + /arena.
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
