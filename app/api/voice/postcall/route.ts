import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyElevenLabsSignature } from "@/lib/voice/auth";
import { OMNI_BUSINESS_ID } from "@/lib/voice/config";
import { emailOwner, ownerCard } from "@/lib/voice/notify";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// ElevenLabs post-call webhook (type "post_call_transcription"). Stores one row
// per completed call in omni_voice_calls (idempotent on conversation_id) for the
// Mythos dashboard, then emails the owner a recap. Must reply 200 fast and read
// the RAW body — the HMAC signature is over the exact bytes, so req.text().
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("elevenlabs-signature");

  if (!verifyElevenLabsSignature(raw, signature, process.env.VOICE_POSTCALL_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: {
    type?: string;
    data?: {
      conversation_id?: string;
      agent_id?: string;
      status?: string;
      transcript?: unknown;
      metadata?: {
        call_duration_secs?: number;
        phone_call?: { external_number?: string };
      };
      analysis?: {
        call_successful?: string;
        transcript_summary?: string;
        data_collection_results?: Record<string, unknown>;
      };
      has_audio?: boolean;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Acknowledge non-transcription events (audio, call_initiation_failure) so
  // ElevenLabs doesn't retry them.
  if (event.type !== "post_call_transcription" || !event.data?.conversation_id) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const d = event.data;
  const summary = d.analysis?.transcript_summary ?? null;
  const caller = d.metadata?.phone_call?.external_number ?? null;
  const duration = d.metadata?.call_duration_secs ?? null;

  // Persist first (idempotent on conversation_id — a retry can't duplicate),
  // then notify. Awaited before the 200 since Next 14 has no after() here; the
  // work is a single upsert + one email, well within the webhook's tolerance.
  const supabase = createAdminClient();
  try {
    await supabase.from("omni_voice_calls").upsert(
      {
        conversation_id: d.conversation_id,
        business_id: OMNI_BUSINESS_ID,
        agent_id: d.agent_id ?? null,
        caller_number: caller,
        status: d.status ?? null,
        call_successful: d.analysis?.call_successful ?? null,
        call_duration_secs: duration,
        summary,
        transcript: d.transcript ?? null,
        data_collected: d.analysis?.data_collection_results ?? null,
        analysis: d.analysis ?? null,
        has_audio: Boolean(d.has_audio),
        raw: event,
      },
      { onConflict: "conversation_id" },
    );
  } catch (e) {
    console.error("[voice/postcall] upsert failed:", e);
  }

  const mins = duration != null ? `${Math.round(duration / 60)}m ${duration % 60}s` : "—";
  await emailOwner({
    subject: `Voice call recap${caller ? ` — ${caller}` : ""}`,
    html: ownerCard(
      "Voice receptionist",
      "Call completed",
      [
        ["Caller", caller || "—"],
        ["Duration", mins],
        ["Outcome", d.analysis?.call_successful || "—"],
      ],
      summary || "No summary was generated for this call.",
    ),
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
