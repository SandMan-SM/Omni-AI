import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET — fetch recent commands + responses (polling for live chat)
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("agent_commands")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

// POST — send a new command to the agent
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const command = {
      command: body.command,
      command_type: body.command_type || "chat",
      target_project: body.target_project || null,
      status: "pending",
      priority: body.priority || 5,
      created_by: "admin",
    };

    const { data, error } = await supabase
      .from("agent_commands")
      .insert(command)
      .select()
      .single();

    if (error) throw error;

    // Also send to Telegram so the agent gets pinged. Credentials come from
    // env only — no hardcoded fallbacks (they'd ship to the repo and leak
    // the real bot token to anyone with source access).
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      try {
        const tgMsg = `🎯 <b>LIVE COMMAND</b>\n\n${body.target_project ? `📦 Project: ${body.target_project}\n` : ""}💬 ${body.command}\n\n⏳ Status: Queued`;
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: tgMsg,
            parse_mode: "HTML",
          }),
        });
      } catch {
        // Telegram notification is best-effort
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    // Never leak raw error messages — they can contain Supabase schema
    // details or internal paths. Log server-side, return generic to client.
    console.error("agent commands POST error:", err);
    return NextResponse.json(
      { error: "We couldn't send that command. Please try again." },
      { status: 500 },
    );
  }
}
