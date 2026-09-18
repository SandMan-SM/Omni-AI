// Pricing page — high-intent conversion surface. Visitors arriving from
// ad campaigns or LLM citations expect instant feedback, not a white flash.
export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading pricing…</p>
      </div>
    </div>
  );
}
