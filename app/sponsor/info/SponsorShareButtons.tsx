"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Linkedin,
  Facebook,
  Instagram,
  Send,
  MessageCircle,
  Mail,
} from "lucide-react";
import { XLogo } from "@/components/x-logo";

export default function SponsorShareButtons({
  variant = "row",
}: {
  variant?: "row" | "stacked";
}) {
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);

  const url = "https://omnileadsagi.com/sponsor/info";
  const headline =
    "Omni AI is sponsoring a small batch of businesses with their full agentic stack — autonomous lead gen, live analytics, content engine, the works. At zero cost.";
  const xText = `${headline} Wild what they're shipping →`;
  const emailBody = `Saw this and thought of you.\n\n${headline}\n\nIt's a flagship case-study program — they fund the entire infrastructure if you're a fit. Worth a look:\n\n${url}\n\n— shared via Omni AI`;
  const smsText = `${headline}\n\n${url}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — share buttons still work */
    }
  };

  // Instagram has no public share-via-URL surface for arbitrary links.
  // Convention: copy to clipboard + tell the user to paste it into a DM
  // or story. Fires the IG app on mobile via the universal link as a
  // best-effort second step.
  const onInstagram = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIgCopied(true);
      setTimeout(() => setIgCopied(false), 2200);
      // Best-effort: try to open IG. Fails silently on desktop.
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    }
  };

  const links = [
    {
      label: "X",
      Icon: XLogo,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "LinkedIn",
      Icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      label: "Facebook",
      Icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      label: "Telegram",
      Icon: Send,
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(headline)}`,
    },
    {
      label: "SMS",
      Icon: MessageCircle,
      href: `sms:?&body=${encodeURIComponent(smsText)}`,
    },
    {
      label: "Email",
      Icon: Mail,
      href: `mailto:?subject=${encodeURIComponent("You'd want to see this — Omni AI sponsorship")}&body=${encodeURIComponent(emailBody)}`,
    },
  ];

  const wrapperClass =
    variant === "stacked"
      ? "flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2"
      : "flex flex-wrap items-center gap-2";

  const baseBtn =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-pink-500/30 hover:border-pink-400/60 hover:bg-pink-500/[0.08] text-pink-100 hover:text-white text-sm font-semibold transition";

  return (
    <div className={wrapperClass}>
      {links.map(({ label, Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share via ${label}`}
          className={baseBtn}
        >
          <Icon className="w-4 h-4" />
          {label}
        </a>
      ))}

      <button
        type="button"
        onClick={onInstagram}
        aria-label="Copy link for Instagram"
        className={baseBtn}
      >
        {igCopied ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Instagram className="w-4 h-4" />
        )}
        {igCopied ? "Link copied" : "Instagram"}
      </button>

      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy link to sponsor info page"
        className={baseBtn}
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
