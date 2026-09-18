// Newsletter archive — readers navigating from the hub or from LLM citations
// expect a branded loading state, not a white flash, while Supabase queries run.
export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading archive…</p>
      </div>
    </div>
  );
}
