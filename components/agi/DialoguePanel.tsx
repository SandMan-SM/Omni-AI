"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Loader2,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

/**
 * DialoguePanel — surfaces the Pantheon's running conversation.
 *
 * Reads /api/council/dialogue. Each thread shows the topic + business
 * (if scoped) + every message ordered chronologically. Proposed
 * actions surface as badges on the message that produced them.
 *
 * The dialogue cron writes new threads every 30 minutes in response
 * to system_findings + intel_digest, so refreshing this view shows
 * the most recent agent activity. No clicks required for the loop
 * to advance — the council talks while the operator sleeps.
 */
type Message = {
  id: string;
  from: string;
  archetype: string;
  to: string | null;
  message_md: string;
  in_reply_to_id: string | null;
  created_at: string;
  proposed_action: { kind?: string; target?: string } | null;
};

type Thread = {
  thread_id: string;
  topic: string;
  business_label: string | null;
  opened_at: string;
  messages: Message[];
};

const TOPIC_LABEL: Record<string, string> = {
  leads_zero: "Leads silent",
  leads_drop: "Leads drop",
  page_views_drop: "Traffic drop",
  newsletter_opens_drop: "Open rate drop",
  lighthouse_perf: "Lighthouse perf",
  morning: "Morning briefing",
  ad_hoc: "Ad-hoc",
};

const ARCHETYPE_ACCENT: Record<string, string> = {
  mythic_egyptian: "text-amber-300 border-amber-300/40",
  sentinel: "text-rose-300 border-rose-300/40",
  greek: "text-sky-300 border-sky-300/40",
  philosopher: "text-emerald-300 border-emerald-300/40",
  modern_thinker: "text-fuchsia-300 border-fuchsia-300/40",
  coder: "text-purple-300 border-purple-300/40",
  titan: "text-rose-200 border-rose-300/40",
  mortal: "text-zinc-300 border-zinc-500/40",
};

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export function DialoguePanel() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [proposalsOpen, setProposalsOpen] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/council/dialogue")
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: { threads?: Thread[]; proposals_open?: number }) => {
        setThreads(d.threads || []);
        setProposalsOpen(d.proposals_open || 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // Re-fetch every 60s — dialogue cron writes every 30 min, so this
    // catches anything fresh within a minute of it landing.
    const t = window.setInterval(fetchData, 60_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <MessageSquare className="h-6 w-6 text-purple-400" />
            Pantheon Dialogue
          </h2>
          <p className="text-sm text-zinc-400">
            The council talks while you sleep. Threads update every 30
            minutes from findings + intel digests.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-200">
            {proposalsOpen} open proposals
          </span>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Threads */}
      {loading && threads.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : threads.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-950/40">
          <CardContent className="py-12 text-center text-zinc-500">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
            No dialogue yet. The cron fires every 30 minutes and reacts to
            findings + the morning digest. First thread opens on the next run.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {threads.map((th) => (
            <Card
              key={th.thread_id}
              className="border-zinc-800 bg-zinc-950/40"
            >
              <CardHeader className="border-b border-zinc-800/60 pb-3">
                <CardTitle className="flex items-baseline justify-between text-base text-white">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    {TOPIC_LABEL[th.topic] || th.topic}
                    {th.business_label && (
                      <span className="text-zinc-500">· {th.business_label}</span>
                    )}
                  </span>
                  <span className="text-xs font-normal text-zinc-500">
                    opened {fmtAgo(th.opened_at)} ago · {th.messages.length} messages
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-800/60 p-0">
                {th.messages.map((m) => {
                  const accent =
                    ARCHETYPE_ACCENT[m.archetype] ||
                    "text-zinc-300 border-zinc-500/40";
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-4"
                    >
                      <div className="flex shrink-0 items-baseline gap-1.5 sm:w-44 sm:flex-col sm:gap-0">
                        <span
                          className={`font-serif text-base ${accent.split(" ")[0]}`}
                        >
                          {m.from}
                        </span>
                        {m.to && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <ArrowRight className="h-3 w-3" /> {m.to}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          {fmtAgo(m.created_at)}
                        </span>
                      </div>
                      <div className="flex-1 text-sm leading-relaxed text-zinc-200">
                        <p
                          dangerouslySetInnerHTML={{
                            __html: m.message_md
                              .replace(
                                /\*\*(.+?)\*\*/g,
                                '<strong class="text-white">$1</strong>',
                              )
                              .replace(
                                /`(.+?)`/g,
                                '<code class="rounded bg-black/40 px-1 py-0.5 text-xs text-amber-200">$1</code>',
                              ),
                          }}
                        />
                        {m.proposed_action && (
                          <div className="mt-2">
                            <Badge className="border-amber-400/40 bg-amber-500/10 text-amber-200">
                              proposal · {m.proposed_action.kind}
                              {m.proposed_action.target
                                ? ` → ${String(m.proposed_action.target).slice(0, 60)}`
                                : ""}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-xs text-zinc-600">
        Powered by Omni AI ·{" "}
        <Link
          href="/oracle"
          className="underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          read the codex
        </Link>
      </p>
    </div>
  );
}
