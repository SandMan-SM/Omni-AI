export default function ArenaLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading the Arena…</p>
      </div>
    </div>
  );
}
