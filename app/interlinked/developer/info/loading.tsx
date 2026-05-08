// Loading skeleton for /interlinked/developer/info. Page bundles
// framer-motion + lucide icons + a client-only signup form, so a
// cold navigation from an email CTA or social share can flash blank
// for a beat. Purple spinner matches the Interlinked namespace
// accent (see /interlinked and /interlinked/premium loading states)
// so the transition into the rendered shell stays continuous.
export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading Developer Curriculum…</p>
      </div>
    </div>
  );
}
