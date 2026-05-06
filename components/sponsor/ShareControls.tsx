"use client";

// ShareControls — drop-in share affordance with native Web Share API
// fallback to per-platform intents. Use this on every shareable
// element — sponsor cards, blog posts, landing pages, podcast episodes.
//
// Every interaction pings the central inbound_<slug>_events table so
// the operator's dashboard can see "share count by post by platform"
// without each tenant site needing its own analytics pipeline.

import { useCallback, useState } from "react";

interface ShareControlsProps {
  url: string;
  title: string;
  slug: string;
  /** Optional event tag — distinguishes "share this sponsor card" from
   *  "share this blog post" in analytics. */
  target?: string;
  align?: "left" | "center" | "right";
  /** Optional: override which platforms render. Default = all. */
  platforms?: Array<"native" | "twitter" | "linkedin" | "sms" | "email" | "copy">;
}

const ANALYTICS_HOST = "https://omnileadsagi.com";

function ping(slug: string, target: string, platform: string, shareUrl: string) {
  if (typeof window === "undefined") return;
  try {
    fetch(`${ANALYTICS_HOST}/api/inbound/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: "share",
        event_category: "share",
        action: "click",
        target_id: target,
        target_type: "share_button",
        page_url: window.location.href,
        properties: { platform, target, share_url: shareUrl },
      }),
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}

export function ShareControls({
  url,
  title,
  slug,
  target = "page",
  align = "left",
  platforms = ["native", "twitter", "linkedin", "sms", "email", "copy"],
}: ShareControlsProps) {
  const [copied, setCopied] = useState(false);

  const supportsNative = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onNative = useCallback(async () => {
    ping(slug, target, "native", url);
    try {
      await navigator.share({ title, url });
    } catch {
      /* user cancelled — not an error */
    }
  }, [slug, target, title, url]);

  const onTwitter = useCallback(() => {
    ping(slug, target, "twitter", url);
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }, [slug, target, title, url]);

  const onLinkedIn = useCallback(() => {
    ping(slug, target, "linkedin", url);
    const intent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }, [slug, target, url]);

  const onSms = useCallback(() => {
    ping(slug, target, "sms", url);
    // sms: scheme works on mobile; on desktop the user gets a no-op
    // dialog which is acceptable degradation.
    window.location.href = `sms:?body=${encodeURIComponent(`${title} — ${url}`)}`;
  }, [slug, target, title, url]);

  const onEmail = useCallback(() => {
    ping(slug, target, "email", url);
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;
  }, [slug, target, title, url]);

  const onCopy = useCallback(async () => {
    ping(slug, target, "copy", url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for browsers without Clipboard API: no-op rather than
      // a confusing alert. Native share covers this on mobile.
    }
  }, [slug, target, url]);

  const justify =
    align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  // Only render native share when the platform actually supports it —
  // otherwise the "Share" button does nothing and confuses users.
  const list = platforms.filter((p) => p !== "native" || supportsNative);

  return (
    <div
      role="group"
      aria-label={`Share ${target}`}
      // osb-share-row class lets the parent SponsorBlock tighten the
      // gap + button padding via media query on narrow phones.
      className="osb-share-row"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: justify,
        marginTop: 10,
        fontSize: 12,
      }}
    >
      {list.map((p) => {
        const common = {
          style: {
            background: "transparent",
            border: "1px solid #3f3f46",
            color: "#d4d4d8",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          } as React.CSSProperties,
        };
        if (p === "native") {
          return (
            <button key="native" type="button" onClick={onNative} {...common}>
              Share
            </button>
          );
        }
        if (p === "twitter") {
          return (
            <button key="twitter" type="button" onClick={onTwitter} {...common}>
              X / Twitter
            </button>
          );
        }
        if (p === "linkedin") {
          return (
            <button key="linkedin" type="button" onClick={onLinkedIn} {...common}>
              LinkedIn
            </button>
          );
        }
        if (p === "sms") {
          return (
            <button key="sms" type="button" onClick={onSms} {...common}>
              SMS
            </button>
          );
        }
        if (p === "email") {
          return (
            <button key="email" type="button" onClick={onEmail} {...common}>
              Email
            </button>
          );
        }
        if (p === "copy") {
          return (
            <button key="copy" type="button" onClick={onCopy} {...common}>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}
