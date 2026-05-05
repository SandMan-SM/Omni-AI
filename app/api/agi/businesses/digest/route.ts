// Daily advancement digest — captures today's snapshot for every business,
// computes deltas vs yesterday + last week, and pushes a Telegram summary
// to the owner.
//
// Trigger options:
//   - Manual: GET / POST this endpoint from the dashboard
//   - Scheduled: Claude Code scheduled task hits this once a day
//
// Telegram message highlights the top 3 businesses by advancement-score
// delta and any business that newly converted a lead in the past 24h.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegram } from "@/lib/agi/telegram";
import { authorizeCronOrAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface SnapshotRow {
  business_id: string;
  snapshot_date: string;
  leads_total: number;
  leads_converted: number;
  meetings_upcoming: number;
  advancement_score: number;
}

async function run(req: NextRequest): Promise<NextResponse> {
  // Auth-gate the daily digest. Without this, an attacker could repeatedly
  // POST this endpoint to spam the owner's Telegram + force RPC-driven
  // snapshot inserts on every call.
  const denied = await authorizeCronOrAdmin(req);
  if (denied) return denied;
  // 1. Capture today's snapshot via the SQL helper (idempotent)
  const { error: snapErr } = await sb.rpc("omni_ai_capture_advancement_snapshots");
  if (snapErr) {
    console.error("[digest] snapshot capture failed:", snapErr);
    return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }

  // 2. Pull current advancement state + previous snapshots for delta math
  const { data: current } = await sb
    .from("omni_business_advancement")
    .select("business_id, business_name, advancement_score, leads_total, leads_converted, leads_added_7d, meetings_upcoming");
  if (!current || current.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "no businesses" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const businessIds = current.map(c => c.business_id);
  const { data: history } = await sb
    .from("omni_business_advancement_snapshots")
    .select("business_id, snapshot_date, leads_total, leads_converted, meetings_upcoming, advancement_score")
    .in("business_id", businessIds)
    .in("snapshot_date", [yesterday, weekAgo])
    .returns<SnapshotRow[]>();

  const yMap = new Map<string, SnapshotRow>();
  const wMap = new Map<string, SnapshotRow>();
  for (const r of history ?? []) {
    if (r.snapshot_date === yesterday) yMap.set(r.business_id, r);
    if (r.snapshot_date === weekAgo) wMap.set(r.business_id, r);
  }

  // 3. Build deltas
  const deltas = current.map(c => {
    const y = yMap.get(c.business_id);
    const w = wMap.get(c.business_id);
    return {
      business_name: c.business_name,
      advancement_score: c.advancement_score,
      score_delta_24h: y ? c.advancement_score - y.advancement_score : 0,
      score_delta_7d:  w ? c.advancement_score - w.advancement_score : 0,
      leads_added_24h: y ? c.leads_total - y.leads_total : 0,
      leads_added_7d:  c.leads_added_7d ?? 0,
      conversions_24h: y ? c.leads_converted - y.leads_converted : 0,
      meetings_upcoming: c.meetings_upcoming,
    };
  });

  // 4. Format Telegram message
  const top = deltas
    .filter(d => d.score_delta_7d > 0 || d.leads_added_7d > 0 || d.conversions_24h > 0)
    .sort((a, b) => b.score_delta_7d - a.score_delta_7d)
    .slice(0, 3);

  const totalLeads24h = deltas.reduce((s, d) => s + d.leads_added_24h, 0);
  const totalConv24h = deltas.reduce((s, d) => s + d.conversions_24h, 0);
  const totalMeetings = deltas.reduce((s, d) => s + d.meetings_upcoming, 0);

  // Escape interpolated business names so a tenant called e.g.
  // "Smith_Co" doesn't break Markdown parsing and silently drop the
  // entire digest. Static markers like the *headers* stay untouched.
  const md = (s: string | null | undefined) =>
    (s ? String(s) : '').replace(/[*_`\[]/g, c => `\\${c}`);

  const lines: string[] = [];
  lines.push("📊 *Business Advancement Digest*");
  lines.push("");
  lines.push(`*${md(today)}*`);
  lines.push(`Last 24h: *+${totalLeads24h}* leads · *+${totalConv24h}* conversions`);
  lines.push(`Pipeline: *${totalMeetings}* upcoming meetings across all businesses`);

  if (top.length > 0) {
    lines.push("");
    lines.push("*🏆 Top movers (last 7 days)*");
    for (const t of top) {
      const arrow = t.score_delta_7d > 0 ? "↑" : t.score_delta_7d < 0 ? "↓" : "—";
      lines.push(`• *${md(t.business_name)}* — score ${t.advancement_score} (${arrow}${Math.abs(t.score_delta_7d)}), +${t.leads_added_7d} leads`);
    }
  }

  const text = lines.join("\n");
  const telegramReady = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  let sent = false;
  if (telegramReady) {
    const r = await sendTelegram({ text, parse_mode: "Markdown" });
    sent = r.ok;
    if (!r.ok) console.error("[digest] telegram failed:", r.error);
  }

  return NextResponse.json({
    ok: true, sent, telegram_configured: telegramReady,
    businesses_tracked: deltas.length,
    top_movers: top.length,
    preview: text,
  });
}

export const GET = run;
export const POST = run;
