"use client";

import { useState } from "react";
import { Copy, Check, Twitter, Linkedin, Mail } from "lucide-react";

export default function PartnerShareButtons({
  partnerName,
  slug,
}: {
  partnerName: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = `https://omnileadsagi.com/partners/${slug}`;
  const text = `${partnerName} is running on Omni AI's agentic infrastructure. See how:`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — share buttons still work */
    }
  };

  const links = [
    {
      label: "Twitter",
      Icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "LinkedIn",
      Icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      label: "Email",
      Icon: Mail,
      href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-gray-500 mr-1">Share</span>
      {links.map(({ label, Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${label}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-500/[0.06] text-gray-300 hover:text-white text-xs font-medium transition"
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </a>
      ))}
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy partner page link"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-500/[0.06] text-gray-300 hover:text-white text-xs font-medium transition"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
