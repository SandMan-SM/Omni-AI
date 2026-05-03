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

export default function PartnerShareButtons({
  partnerName,
  slug,
}: {
  partnerName: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);

  const url = `https://omnileadsagi.com/partners/${slug}`;
  const headline = `${partnerName} is running on Omni AI's agentic infrastructure. See how:`;
  const emailBody = `Take a look at this — ${partnerName} is running their growth on Omni AI's agentic infrastructure: live site analytics, autonomous lead gen, AI-driven content, the works.\n\n${url}\n\n— shared via Omni AI`;
  const smsText = `${headline}\n${url}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  // Instagram has no public share-via-URL surface — copy + open IG.
  const onInstagram = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIgCopied(true);
      setTimeout(() => setIgCopied(false), 2200);
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    }
  };

  const links = [
    {
      label: "X",
      Icon: XLogo,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(headline)}&url=${encodeURIComponent(url)}`,
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
      href: `mailto:?subject=${encodeURIComponent(`${partnerName} × Omni AI — agentic growth partnership`)}&body=${encodeURIComponent(emailBody)}`,
    },
  ];

  const baseBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-500/[0.06] text-gray-300 hover:text-white text-xs font-medium transition";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-gray-500 mr-1">Share</span>

      {links.map(({ label, Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share via ${label}`}
          className={baseBtn}
        >
          <Icon className="w-3.5 h-3.5" />
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
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Instagram className="w-3.5 h-3.5" />
        )}
        {igCopied ? "Copied" : "Instagram"}
      </button>

      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy partner page link"
        className={baseBtn}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
