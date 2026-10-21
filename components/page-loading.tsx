/**
 * components/page-loading.tsx — shared route-level loading skeleton.
 *
 * Why this exists:
 *  Data-fetching routes were each hand-rolling the same centered
 *  amber spinner, and roughly a dozen dynamic routes shipped with no
 *  loading.tsx at all — so a visitor landing on one of them got a
 *  blank white/dark flash while the server component waited on
 *  Supabase. A shared component keeps the treatment identical across
 *  every route that needs one, and makes adding a new route a
 *  one-line import instead of a copy-paste block.
 *
 * The visual matches the treatment already shipped on /about, /arena,
 *  /campaigns and /newsletter: black field, amber ring, muted label.
 */
export default function PageLoading({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">{label}</p>
      </div>
    </div>
  );
}
