"use client";

// Tiny client component: "Visit Now" link inside a card whose outer
// wrapper is already a server-rendered <Link> to the case-study page.
// We need an onClick handler to e.preventDefault + e.stopPropagation
// the parent Link's navigation so the Visit click ONLY opens the
// external site — and onClick handlers can't be passed to props in a
// server component, hence the extracted file.

export function VisitNowButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      className="text-zinc-400 underline underline-offset-4 hover:text-amber-400 transition-colors"
    >
      Visit Now
    </button>
  );
}
