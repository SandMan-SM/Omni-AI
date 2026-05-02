/**
 * Subtle attribution footer rendered at the bottom of every newsletter
 * post (web view + email HTML). Links to /partners/<slug> — the
 * co-branded conversion landing — so every newsletter doubles as a top-
 * of-funnel asset for Omni AI.
 *
 * Both the inline web component (default export) and the email-safe HTML
 * snippet are exported so the same brand is used everywhere.
 */

import Link from "next/link";

export function PoweredByOmniAi({ partnerSlug }: { partnerSlug: string }) {
  const safe = (partnerSlug || "").trim().toLowerCase() || "omnileads";
  return (
    <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-center">
      <Link
        href={`/partners/${safe}`}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.06] to-cyan-500/[0.06] text-[11px] font-medium tracking-wide text-emerald-300/90 hover:text-emerald-200 hover:border-emerald-400/30 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400" />
        Powered by <span className="font-semibold">Omni AI</span>
      </Link>
    </div>
  );
}

/**
 * Email-safe HTML for the same footer. Resend renders inline styles only,
 * so we hand-roll a table-free badge that survives every major client.
 * Used by the newsletter HTML email template generator.
 */
export function poweredByOmniAiEmailHtml(partnerSlug: string): string {
  const safe = (partnerSlug || "").trim().toLowerCase() || "omnileads";
  const url = `https://omnileadsagi.com/partners/${safe}`;
  return `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <a href="${url}" style="display:inline-block;padding:6px 14px;border-radius:9999px;background:linear-gradient(90deg,#ecfeff,#f0fdfa);color:#047857;font-size:11px;font-weight:600;letter-spacing:.04em;text-decoration:none;border:1px solid #a7f3d0">
        Powered by Omni AI
      </a>
    </div>
  `;
}

export default PoweredByOmniAi;
