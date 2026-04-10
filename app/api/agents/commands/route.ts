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

    // Also send to Telegram so the agent gets pinged
    try {
      const tgMsg = `🎯 <b>LIVE COMMAND</b>\n\n${body.target_project ? `📦 Project: ${body.target_project}\n` : ""}💬 ${body.command}\n\n⏳ Status: Queued`;
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || "8552859161:AAFDZaowgtStb-8tRuBaVshLe379bDL6k1s"}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID || "8459911167",
            text: tgMsg,
            parse_mode: "HTML",
          }),
        }
      );
    } catch {
      // Telegram notification is best-effort
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
