import { createAdminClient } from "@/lib/supabase/admin";
import { OMNI_BUSINESS_ID } from "@/lib/voice/config";

// Send a transactional SMS via Twilio and log it to omni_sms_sends, mirroring
// the pattern in app/api/agi/sms/send. Used for the caller-requested booking
// recap. Kept as a direct helper (not a self-fetch to the CRON-gated sms/send
// route) so the voice flow doesn't need to carry the CRON_SECRET.
//
// Fire-and-forget from the caller's perspective: a failed recap text must never
// fail the booking, so callers should not await this on the critical path.
export async function sendVoiceSms(opts: {
  toPhone: string;
  body: string;
  leadId?: string | null;
}): Promise<{ ok: boolean; sid?: string; stub?: boolean }> {
  const { toPhone, body, leadId } = opts;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  const supabase = createAdminClient();
  let recordId: string | undefined;
  try {
    const { data } = await supabase
      .from("omni_sms_sends")
      .insert({
        business_id: OMNI_BUSINESS_ID,
        lead_id: leadId ?? null,
        to_phone: toPhone,
        body,
        status: "draft",
      })
      .select("id")
      .single();
    recordId = data?.id;
  } catch (e) {
    console.error("[voice/sms] log insert failed:", e);
  }

  if (!sid || !token || !from) {
    if (recordId) {
      await supabase
        .from("omni_sms_sends")
        .update({ status: "sent", sent_at: new Date().toISOString(), twilio_sid: `stub-${Date.now()}` })
        .eq("id", recordId);
    }
    return { ok: true, stub: true };
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({ From: from, To: toPhone, Body: body });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    let resp: Response;
    try {
      resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (recordId) {
        await supabase.from("omni_sms_sends").update({ status: "failed" }).eq("id", recordId);
      }
      console.error("[voice/sms] twilio error:", result?.message ?? resp.status);
      return { ok: false };
    }
    if (recordId) {
      await supabase
        .from("omni_sms_sends")
        .update({ status: "sent", sent_at: new Date().toISOString(), twilio_sid: result.sid })
        .eq("id", recordId);
    }
    return { ok: true, sid: result.sid };
  } catch (e) {
    console.error("[voice/sms] send failed:", e);
    if (recordId) {
      await supabase.from("omni_sms_sends").update({ status: "failed" }).eq("id", recordId);
    }
    return { ok: false };
  }
}
