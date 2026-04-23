"use client";

/**
 * Generic share button — opens the OS / browser share sheet via the Web
 * Share API (mobile AirDrop, Messages, Mail, X, Copy Link, etc). On
 * desktop browsers that don't implement navigator.share we fall back to
 * writing the URL to the clipboard and showing a "Copied" tooltip.
 *
 * Used on /newsletter/[slug] next to the "Schedule a Meeting" CTA.
 */

import { Share2 } from "lucide-react";
import { useState } from "react";

interface ShareButtonProps {
  title: string;
  text?: string;
  url: string;
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Try the native share sheet first (mobile + most modern desktop).
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // User cancelled the share sheet — treat as a no-op, don't fall
        // through to the clipboard copy.
        if ((err as { name?: string })?.name === "AbortError") return;
        // Any other error: continue to clipboard fallback below.
      }
    }

    // Fallback: copy to clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last-ditch: show a prompt so the user can still grab the link.
      window.prompt("Copy this link:", url);
    }
  };

  // Chrome-gold gradient border trick: two stacked backgrounds — solid
  // dark on the padding-box, chrome-gold gradient on the border-box —
  // with a transparent border. This preserves border-radius (which a
  // real CSS `border-image` with rounded corners can't always honor).
  const chromeGoldBorder: React.CSSProperties = {
    background:
      "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55)) padding-box, " +
      "linear-gradient(135deg, #fff5b8 0%, #ffd700 20%, #b8860b 45%, #ffd700 70%, #fff5b8 100%) border-box",
    border: "2px solid transparent",
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share this issue"
      title={copied ? "Link copied!" : "Share this issue"}
      style={chromeGoldBorder}
      className="relative inline-flex items-center justify-center w-11 h-11 rounded-xl text-[#ffd700] hover:brightness-125 active:scale-[0.98] transition-all shadow-[0_0_12px_rgba(255,215,0,0.35)]"
    >
      <Share2 className="w-4 h-4" />
      {copied && (
        <span
          aria-live="polite"
          className="absolute -top-9 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-widest text-amber-300 bg-black/85 border border-amber-500/40 px-2 py-1 rounded whitespace-nowrap"
        >
          Copied
        </span>
      )}
    </button>
  );
}
