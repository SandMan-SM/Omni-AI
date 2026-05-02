"use client";

import { useState } from "react";
import { Copy, Check, Twitter, Linkedin, Mail, Send } from "lucide-react";

export default function SponsorShareButtons({
  variant = "row",
}: {
  variant?: "row" | "stacked";
}) {
  const [copied, setCopied] = useState(false);
  const url = "https://omnileadsagi.com/sponsor/info";
  const headline = "Omni AI is sponsoring a small batch of businesses with their full agentic stack — autonomous lead gen, live analytics, content engine, the works. At zero cost.";
  const tweet = `${headline} Wild what they're shipping →`;
  const emailBody = `Saw this and thought of you.\n\n${headline}\n\nIt's a flagship case-study program — they fund the entire infrastructure if you're a fit. Worth a look:\n\n${url}\n\n— shared via Omni AI`;

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
      label: "Tweet it",
      Icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "Share on LinkedIn",
      Icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      label: "Email a friend",
      Icon: Mail,
      href: `mailto:?subject=${encodeURIComponent("You'd want to see this — Omni AI sponsorship")}&body=${encodeURIComponent(emailBody)}`,
    },
    {
      label: "Text it",
      Icon: Send,
      href: `sms:?&body=${encodeURIComponent(`${headline}\n\n${url}`)}`,
    },
  ];

  const wrapperClass =
    variant === "stacked"
      ? "flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2"
      : "flex flex-wrap items-center justify-center gap-2";

  return (
    <div className={wrapperClass}>
      {links.map(({ label, Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/[0.08] text-amber-200 hover:text-white text-sm font-semibold transition"
        >
          <Icon className="w-4 h-4" />
          {label}
        </a>
      ))}
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy link to sponsor info page"
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/[0.08] text-amber-200 hover:text-white text-sm font-semibold transition"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
