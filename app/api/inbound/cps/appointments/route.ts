import { NextResponse } from "next/server";
import { handleCpsAppointmentPost } from "@/lib/server/cps-appointment-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    ok: true,
    workflow: "cps-appointment-2026-v1",
    authentication:
      process.env.NODE_ENV === "development"
        ? "loopback_dev_or_vercel_oidc"
        : "vercel_oidc",
  });
}

export async function POST(request: Request) {
  return handleCpsAppointmentPost(request);
}

