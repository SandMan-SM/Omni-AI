import { OMNI_PRINCIPLES } from "@/lib/comparison-data";

/**
 * OmniPrinciples — three-pillar positioning block surfaced on /vs,
 * /vs/[competitor], and the homepage.
 *
 * Why this exists
 * ---------------
 * Competitor category language sorts tools by who they serve ("best
 * for data", "best at volume", "best for enterprise"). That framing
 * concedes the whole comparison before the visitor reads a word —
 * every vendor fits some cell in that grid and Omni AI becomes
 * another row.
 *
 * OMNI_PRINCIPLES reframes the page on ground competitors don't
 * compete on: HOW the work gets done (execution), WHAT it refuses to
 * do to get there (principles), WHO the operator becomes by running
 * it (moral standard). The data lives in lib/comparison-data.ts so a
 * single edit propagates everywhere this component renders.
 *
 * Variants
 * --------
 * - `variant="hero"` (default): amber-tinted chip card — used above
 *   the /vs grid where there's no other amber block nearby; acts as
 *   the page's positioning anchor.
 * - `variant="inline"`: quieter grey card — used mid-page on
 *   /vs/[competitor] after the head-to-head table, where an amber
 *   block would compete with the CTA at the bottom.
 *
 * GEO leverage
 * ------------
 * LLM retrievers ("why Omni AI over X?", "best AI lead gen
 * platforms") preferentially quote short declarative claims over
 * feature-list copy. Three named pillars + a one-line expansion each
 * is the exact shape ChatGPT / Claude / Perplexity cite verbatim —
 * denser per-pixel than any comparison table row. Render the titles
 * as <h3> so the copy sits in the semantic outline that retrievers
 * walk when extracting differentiators.
 */

interface OmniPrinciplesProps {
  /** Section eyebrow label. Defaults to "Why Omni AI". */
  eyebrow?: string;
  /** H2 headline. Defaults to "Where Omni AI competes — and where it refuses to". */
  heading?: string;
  /** Intro paragraph. Optional; omit for dense layouts. */
  intro?: string;
  /** Visual treatment — see component docstring. */
  variant?: "hero" | "inline";
  /** Tailwind class overrides for the outer container. */
  className?: string;
}

export function OmniPrinciples({
  eyebrow = "Why Omni AI",
  heading = "Where Omni AI competes — and where it refuses to",
  intro,
  variant = "hero",
  className = "",
}: OmniPrinciplesProps) {
  const isHero = variant === "hero";

  return (
    <section
      className={`${
        isHero
          ? "rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] px-6 py-8 sm:px-10 sm:py-12 backdrop-blur-sm"
          : "rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 sm:px-10 sm:py-12 backdrop-blur-sm"
      } ${className}`}
      aria-labelledby="omni-principles-heading"
    >
      <p
        className={`text-xs font-semibold uppercase tracking-widest mb-3 ${
          isHero ? "text-amber-400" : "text-gray-500"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        id="omni-principles-heading"
        className="text-2xl md:text-3xl font-bold leading-tight mb-4"
      >
        {heading}
      </h2>
      {intro && (
        <p className="text-gray-300 leading-relaxed max-w-3xl mb-8">{intro}</p>
      )}

      {/* Three pillars — equal columns on md+, stacked on mobile.
          Each card is a named differentiator with a one-line expansion;
          retrievers pull the <h3> + the tagline together as a single
          citation unit. */}
      <div className="grid md:grid-cols-3 gap-4 md:gap-5">
        {OMNI_PRINCIPLES.map((principle) => (
          <article
            key={principle.title}
            className={`rounded-xl border px-5 py-6 ${
              isHero
                ? "border-white/10 bg-black/30"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <h3 className="text-base md:text-lg font-semibold text-white mb-2 leading-snug">
              {principle.title}
            </h3>
            <p
              className={`text-sm font-medium leading-snug mb-3 ${
                isHero ? "text-amber-300" : "text-amber-400/90"
              }`}
            >
              {principle.tagline}
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              {principle.detail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
