import { NextRequest, NextResponse } from "next/server";
import { verifyVoiceToolAuth } from "@/lib/voice/auth";
import { OMNI_BUSINESS_ID, siteBaseUrl, humanPacific } from "@/lib/voice/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Voice tool: check_availability
// Returns the next few OPEN strategy-call slots for the receptionist to offer.
// Called live during a call, so it must be fast and must never hard-error (a
// non-200 shows up as dead air / a tool failure) — on trouble we return
// ok:false with an empty list so the agent can fall back to taking a callback.
export async function POST(req: NextRequest) {
  const denied = verifyVoiceToolAuth(req);
  if (denied) return denied;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    let slots: Array<{ start_at: string; available: boolean }> = [];
    try {
      const resp = await fetch(
        `${siteBaseUrl()}/api/agi/meetings/slots?business_id=${OMNI_BUSINESS_ID}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const data = (await resp.json().catch(() => null)) as
        | { slots?: Array<{ start_at: string; available: boolean }> }
        | null;
      slots = data?.slots ?? [];
    } finally {
      clearTimeout(timeout);
    }

    const open = slots
      .filter((s) => s.available)
      .slice(0, 6)
      .map((s) => ({ start_at: s.start_at, label: humanPacific(s.start_at) }));

    if (open.length === 0) {
      return NextResponse.json({
        ok: false,
        slots: [],
        spoken:
          "I don't see any open times on the calendar right now — I can take your details and have someone reach out with options.",
      });
    }

    // A ready-to-speak sentence with the first three options.
    const spoken =
      "The next openings are " +
      open
        .slice(0, 3)
        .map((s) => s.label.replace(/ [A-Z]{2,4}$/, "")) // drop the trailing tz token for speech
        .join(", or ") +
      " Pacific. Which works best?";

    return NextResponse.json({ ok: true, slots: open, spoken });
  } catch (err) {
    console.error("[voice/availability]", err);
    return NextResponse.json({
      ok: false,
      slots: [],
      spoken:
        "I'm having trouble pulling the calendar this second — I can take your details and have someone follow up with times.",
    });
  }
}
