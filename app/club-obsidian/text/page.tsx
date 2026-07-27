"use client";

import { useEffect, useState } from "react";

const PHONE = "+18014581756";
const BODY = "play now";

function smsUrl() {
  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const separator = isAppleMobile ? "&" : "?";
  return `sms:${PHONE}${separator}body=${encodeURIComponent(BODY)}`;
}

export default function ClubObsidianTextPage() {
  const [href, setHref] = useState("");

  useEffect(() => {
    const target = smsUrl();
    setHref(target);
    const timer = window.setTimeout(() => {
      window.location.href = target;
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#09070d] px-5 py-12 text-white">
      <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl">
        <div className="mb-6 text-5xl" aria-hidden="true">📱</div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-300">
          Club Obsidian
        </p>
        <h1 className="text-3xl font-semibold leading-tight">Opening your text message</h1>
        <p className="mt-4 leading-7 text-white/70">
          The message “play now” is already filled in for 801-458-1756. Review it, then tap Send in Messages.
        </p>
        <a
          href={href || undefined}
          className="mt-8 block w-full rounded-2xl bg-white px-5 py-4 text-base font-semibold text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          Text “play now”
        </a>
      </section>
    </main>
  );
}
