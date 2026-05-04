import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/council/dialogue
 *
 * Returns the most recent council dialogue threads + messages, plus a
 * count of open proposals. Public read — the dialogue is platform-level
 * (no per-tenant data; agents talking about findings the system is
 * already surfacing in the federation view).
 *
 * Response shape:
 *   {
 *     threads: Array<{
 *       thread_id, topic, business_label, opened_at, messages_count,
 *       messages: Array<{ id, from, to?, message_md, in_reply_to_id?, created_at, proposed_action? }>
 *     }>,
 *     proposals_open: number
 *   }
 */
type Row = {
  id: string;
  thread_id: string;
  from_agent_id: string;
  to_agent_id: string | null;
  in_reply_to_id: string | null;
  topic: string;
  business_id: string | null;
  message_md: string;
  proposed_action: unknown;
  created_at: string;
};

export async function GET() {
  const sb = createAdminClient();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: msgs }, { data: agents }, { data: businesses }, { count: openProposals }] =
    await Promise.all([
      sb
        .from("pantheon_dialogue")
        .select(
          "id, thread_id, from_agent_id, to_agent_id, in_reply_to_id, topic, business_id, message_md, proposed_action, created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(120),
      sb.from("council_agents").select("id, name, archetype_tier"),
      sb.from("omni_businesses").select("id, name, slug"),
      sb
        .from("pantheon_proposals")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
    ]);

  const agentName = new Map<string, { name: string; archetype: string }>();
  for (const a of (agents || []) as Array<{ id: string; name: string; archetype_tier: string }>) {
    agentName.set(a.id, { name: a.name, archetype: a.archetype_tier });
  }
  const bizLabel = new Map<string, string>();
  for (const b of (businesses || []) as Array<{ id: string; name: string; slug: string | null }>) {
    bizLabel.set(b.id, b.name);
  }

  const rows = (msgs || []) as Row[];

  // Group by thread, threads ordered by their newest message.
  const byThread = new Map<
    string,
    {
      thread_id: string;
      topic: string;
      business_label: string | null;
      opened_at: string;
      messages: Array<{
        id: string;
        from: string;
        archetype: string;
        to: string | null;
        message_md: string;
        in_reply_to_id: string | null;
        created_at: string;
        proposed_action: unknown;
      }>;
    }
  >();

  // Sort by created_at ASC inside each thread for readability.
  const sortedAsc = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const r of sortedAsc) {
    const fromAgent = agentName.get(r.from_agent_id);
    const toAgent = r.to_agent_id ? agentName.get(r.to_agent_id) || null : null;
    if (!fromAgent) continue;
    let bucket = byThread.get(r.thread_id);
    if (!bucket) {
      bucket = {
        thread_id: r.thread_id,
        topic: r.topic,
        business_label: r.business_id ? bizLabel.get(r.business_id) || null : null,
        opened_at: r.created_at,
        messages: [],
      };
      byThread.set(r.thread_id, bucket);
    }
    bucket.messages.push({
      id: r.id,
      from: fromAgent.name,
      archetype: fromAgent.archetype,
      to: toAgent?.name || null,
      message_md: r.message_md,
      in_reply_to_id: r.in_reply_to_id,
      created_at: r.created_at,
      proposed_action: r.proposed_action,
    });
  }

  const threads = Array.from(byThread.values()).sort(
    (a, b) =>
      new Date(b.messages[b.messages.length - 1].created_at).getTime() -
      new Date(a.messages[a.messages.length - 1].created_at).getTime(),
  );

  const res = NextResponse.json({
    threads,
    proposals_open: openProposals || 0,
  });
  // Cache 30s at the edge — dialogue cron writes every 30 min so this
  // is plenty fresh.
  res.headers.set("Cache-Control", "public, max-age=30, s-maxage=30");
  return res;
}
