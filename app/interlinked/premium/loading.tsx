// /interlinked/premium is the Premium upsell landing page — purple accent
// to match the rest of the Interlinked namespace. Client bundle is heavy
// (framer-motion + lucide icons) so the spinner prevents a flash of
// unstyled / blank content on cold navigation from email CTAs.
export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading Interlinked Premium…</p>
      </div>
    </div>
  );
}
