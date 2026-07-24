import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyVoiceToolAuth } from "@/lib/voice/auth";
import { OMNI_BUSINESS_ID, siteBaseUrl, splitName, humanPacific } from "@/lib/voice/config";
import { sendVoiceSms } from "@/lib/voice/sms";
import { emailOwner, ownerCard } from "@/lib/voice/notify";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Voice tool: book_consult
// Books the free 30-minute strategy call for a caller. Captures them as a lead,
// reserves the slot through the existing /api/agi/meetings/book scheduler
// (conflict-check + inbound_omnileads_bookings mirror + Telegram ping), then
// texts a recap and emails the owner after responding. Returns fast so the
// agent can confirm the time on the call without dead air.
export async function POST(req: NextRequest) {
  const denied = verifyVoiceToolAuth(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      start_at?: string;
      notes?: string;
    };

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const start_at = String(body.start_at ?? "").trim();

    if (!name || !email || !start_at) {
      return NextResponse.json(
        { ok: false, error: "name, email, and start_at are required" },
        { status: 200 },
      );
    }
    if (Number.isNaN(Date.parse(start_at))) {
      return NextResponse.json({ ok: false, error: "start_at must be an ISO datetime" }, { status: 200 });
    }

    const { first_name, last_name } = splitName(name);
    const supabase = createAdminClient();

    // Capture the caller as a lead first so the booking can link + promote it.
    let leadId: string | null = null;
    try {
      const { data: lead } = await supabase
        .from("omni_leads_generated")
        .insert({
          business_id: OMNI_BUSINESS_ID,
          first_name,
          last_name,
          email: email || null,
          phone: phone || null,
          source: "voice_receptionist",
          status: "new",
          notes: body.notes?.trim() || null,
          tags: ["voice", "inbound", "booked"],
          raw_data: { channel: "phone", booked_slot: start_at },
        })
        .select("id")
        .single();
      leadId = lead?.id ?? null;
    } catch (e) {
      console.error("[voice/book] lead capture failed (continuing to book):", e);
    }

    // Reserve the slot through the canonical scheduler route (public POST).
    const bookResp = await fetch(`${siteBaseUrl()}/api/agi/meetings/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        business_id: OMNI_BUSINESS_ID,
        lead_id: leadId,
        start_at,
        duration_minutes: 30,
        attendee_name: name,
        attendee_email: email,
        attendee_phone: phone || null,
        attendee_notes: body.notes?.trim() || "Booked by AI voice receptionist",
      }),
    });

    if (bookResp.status === 409) {
      return NextResponse.json({
        ok: false,
        reason: "slot_taken",
        message: "That time was just taken — please offer another opening.",
      });
    }
    const bookData = (await bookResp.json().catch(() => null)) as
      | { ok?: boolean; booking?: { id?: string } }
      | null;
    if (!bookResp.ok || !bookData?.ok) {
      console.error("[voice/book] scheduler rejected:", bookResp.status, bookData);
      return NextResponse.json({
        ok: false,
        reason: "book_failed",
        message: "I couldn't lock that in just now — please take their details for a callback.",
      });
    }

    const when = humanPacific(start_at);
    const bookingId = bookData.booking?.id ?? null;

    // Recap SMS to the caller + owner email, in parallel and timeout-bounded so
    // they can't stall the turn. Awaited (not deferred) because Next 14 has no
    // after()/waitUntil here and serverless freezes floating promises after the
    // response — this keeps delivery reliable while staying well inside the
    // tool's 10s budget.
    await Promise.allSettled([
      phone
        ? sendVoiceSms({
            toPhone: phone,
            leadId,
            body: `You're booked with Omni AI — your free 30-minute strategy call is ${when}. No pitch, just a plan. Questions? Reply here or email alfred@omnileadsagi.com.`,
          })
        : Promise.resolve(),
      emailOwner({
        subject: `Voice booking — ${name} on ${when}`,
        replyTo: email,
        html: ownerCard(
          "Voice receptionist",
          "Strategy call booked by phone",
          [
            ["Name", name],
            ["When", when],
            ["Phone", phone || "—"],
            ["Email", email],
            ["Notes", body.notes?.trim() || "—"],
          ],
          "Booked by the AI receptionist and added to the meetings calendar. The caller got a recap text.",
        ),
      }),
    ]);

    return NextResponse.json({ ok: true, booking_id: bookingId, when });
  } catch (err) {
    console.error("[voice/book]", err);
    return NextResponse.json({
      ok: false,
      reason: "error",
      message: "Something went wrong booking that — please take their details for a callback.",
    }, { status: 200 });
  }
}
