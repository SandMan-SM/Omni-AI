import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyVoiceToolAuth } from "@/lib/voice/auth";
import { OMNI_BUSINESS_ID, splitName } from "@/lib/voice/config";
import { emailOwner, ownerCard } from "@/lib/voice/notify";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Voice tool: capture_lead
// Records a caller as a CRM lead when they're not ready to book a call. Writes
// to omni_leads_generated (source 'voice_receptionist') so they appear in the
// Mythos dashboard, then notifies the owner after the response is sent.
export async function POST(req: NextRequest) {
  const denied = verifyVoiceToolAuth(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      interest?: string;
      notes?: string;
    };

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    // A lead needs a name and at least one way to reach them.
    if (!name || (!phone && !email)) {
      return NextResponse.json(
        { ok: false, error: "name and a phone or email are required" },
        { status: 200 },
      );
    }

    const { first_name, last_name } = splitName(name);
    const supabase = createAdminClient();

    const { data: lead, error } = await supabase
      .from("omni_leads_generated")
      .insert({
        business_id: OMNI_BUSINESS_ID,
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        company: body.company?.trim() || null,
        source: "voice_receptionist",
        status: "new",
        notes: body.notes?.trim() || body.interest?.trim() || null,
        tags: ["voice", "inbound"],
        raw_data: { interest: body.interest ?? null, channel: "phone" },
      })
      .select("id")
      .single();

    if (error) {
      console.error("[voice/capture-lead] insert failed:", error);
      return NextResponse.json({ ok: false, error: "could not save lead" }, { status: 200 });
    }

    // Owner notify — awaited + timeout-bounded (Next 14 has no after() here).
    await emailOwner({
      subject: `New voice lead — ${name}`,
      replyTo: email || undefined,
      html: ownerCard(
        "Voice receptionist",
        "New lead from a phone call",
        [
          ["Name", name],
          ["Phone", phone || "—"],
          ["Email", email || "—"],
          ["Company", body.company?.trim() || "—"],
          ["Interest", body.interest?.trim() || "—"],
          ["Notes", body.notes?.trim() || "—"],
        ],
        "Captured by the AI receptionist. They did not book a call — follow up or let the agent book them next time.",
      ),
    });

    return NextResponse.json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error("[voice/capture-lead]", err);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 200 });
  }
}
