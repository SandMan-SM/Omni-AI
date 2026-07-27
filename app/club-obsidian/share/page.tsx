"use client";

import { useState } from "react";

const INVITE_URL = "https://t.me/+NMGbksBYUiU4YzZh";
const SHARE_TEXT =
  "Join me for the Club Obsidian cash game tonight at 7:00 PM MT. Text ‘play now’ to +1 (801) 458-1756 and include my name so the referral is tracked.";

async function copyInvite(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(INVITE_URL);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = INVITE_URL;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  }
}

export default function ClubObsidianSharePage() {
  const [status, setStatus] = useState("");

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Club Obsidian",
          text: SHARE_TEXT,
          url: INVITE_URL,
        });
        setStatus("Invite shared.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const copied = await copyInvite();
    setStatus(copied ? "Invite link copied." : "Press and hold the link below to copy it.");
  }

  async function copy() {
    const copied = await copyInvite();
    setStatus(copied ? "Invite link copied." : "Press and hold the link below to copy it.");
  }

  return (
    <main className="min-h-screen bg-[#09070d] px-5 py-12 text-white">
      <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl">
        <div className="mb-6 text-5xl" aria-hidden="true">♠️</div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-300">
          Club Obsidian
        </p>
        <h1 className="text-3xl font-semibold leading-tight">Invite a friend</h1>
        <p className="mt-4 leading-7 text-white/70">
          Share through your phone’s contacts or any installed app. Your friend can join using the private invite link.
        </p>

        <button
          type="button"
          onClick={share}
          className="mt-8 w-full rounded-2xl bg-white px-5 py-4 text-base font-semibold text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          Share using my phone
        </button>
        <button
          type="button"
          onClick={copy}
          className="mt-3 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 text-base font-semibold text-white transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          Copy invite link
        </button>

        <a
          href={INVITE_URL}
          className="mt-6 block break-all text-sm leading-6 text-purple-300 underline decoration-purple-300/40 underline-offset-4"
        >
          {INVITE_URL}
        </a>
        <p className="mt-5 min-h-6 text-sm text-emerald-300" aria-live="polite">
          {status}
        </p>
      </section>
    </main>
  );
}
