"use client";

// Share row for case-study pages. Native share where supported,
// X (logo, not bird), LinkedIn, Facebook, SMS, Email, Copy link.
// Each click pings /api/inbound/omnileads/events with
// `event_type=case_share` so we can see which channels move the page.

import { useState } from "react";
import {
  Share2,
  Linkedin,
  Facebook,
  Smartphone,
  Mail,
  Link2,
  Check,
} from "lucide-react";
import { XIcon } from "./XIcon";

type Props = {
  url: string;
  title: string;
  caption?: string;
};

const ENDPOINT = "https://omnileadsagi.com/api/inbound/omnileads/events";

function ping(platform: string, url: string) {
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: "case_share",
        event_category: "share",
        action: "click",
        target_id: platform,
        target_type: "share_button",
        page_url: typeof window !== "undefined" ? window.location.href : null,
        properties: { share_url: url, platform },
      }),
    }).catch(() => {});
  } catch {}
}

export default function ShareRow({ url, title, caption }: Props) {
  const [copied, setCopied] = useState(false);

  function shareNative() {
    ping("native", url);
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      (navigator as Navigator & { share: (d: ShareData) => Promise<void> })
        .share({ title, url })
        .catch(() => {});
    }
  }

  function shareTwitter() {
    ping("twitter", url);
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(u, "_blank", "noopener");
  }

  function shareLinkedIn() {
    ping("linkedin", url);
    const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(u, "_blank", "noopener");
  }

  function shareFacebook() {
    ping("facebook", url);
    const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`;
    window.open(u, "_blank", "noopener");
  }

  function shareSms() {
    ping("sms", url);
    location.href = `sms:?body=${encodeURIComponent(`${title} — ${url}`)}`;
  }

  function shareEmail() {
    ping("email", url);
    location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;
  }

  function copyLink() {
    ping("copy", url);
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const hasNative =
    typeof navigator !== "undefined" &&
    !!(navigator as Navigator & { share?: unknown }).share;

  const baseBtn =
    "inline-flex items-center justify-center gap-2 min-w-[110px] rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:border-amber-400 hover:text-amber-300 hover:bg-zinc-900/90 transition-colors";
  const iconClass = "w-4 h-4 flex-shrink-0";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-6">
      {caption && (
        <p className="text-xs uppercase tracking-[0.32em] text-amber-400 mb-3">{caption}</p>
      )}
      <p className="text-zinc-300 text-sm mb-4">
        Send this to whoever needs to see it.
      </p>
      <div className="flex flex-wrap gap-2">
        {hasNative && (
          <button type="button" onClick={shareNative} className={baseBtn} aria-label="Share">
            <Share2 className={iconClass} />
            <span>Share</span>
          </button>
        )}
        {/* X button intentionally renders icon-only — the X glyph IS the
            brand mark, a 'X' text label next to it read redundantly. The
            aria-label still names the platform for screen readers. */}
        <button type="button" onClick={shareTwitter} className={baseBtn} aria-label="Share to X">
          <XIcon className={iconClass} />
        </button>
        <button type="button" onClick={shareLinkedIn} className={baseBtn} aria-label="Share to LinkedIn">
          <Linkedin className={iconClass} />
          <span>LinkedIn</span>
        </button>
        <button type="button" onClick={shareFacebook} className={baseBtn} aria-label="Share to Facebook">
          <Facebook className={iconClass} />
          <span>Facebook</span>
        </button>
        <button type="button" onClick={shareSms} className={baseBtn} aria-label="Share via SMS">
          <Smartphone className={iconClass} />
          <span>SMS</span>
        </button>
        <button type="button" onClick={shareEmail} className={baseBtn} aria-label="Share via email">
          <Mail className={iconClass} />
          <span>Email</span>
        </button>
        <button type="button" onClick={copyLink} className={baseBtn} aria-label="Copy link">
          {copied ? (
            <>
              <Check className={iconClass} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Link2 className={iconClass} />
              <span>Copy link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
