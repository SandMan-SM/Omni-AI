import { NextResponse } from "next/server";
import { notifyDeploy } from "@/lib/telegram";
import { constantTimeEqual } from "@/lib/api-auth";

// Called by Vercel Deploy Hook to announce new deployments
export async function POST(req: Request) {
  const secret = req.headers.get("x-deploy-secret") || "";
  const expected = process.env.DEPLOY_NOTIFY_SECRET;
  if (!expected || !constantTimeEqual(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let summary = "New deployment pushed live";
  try {
    const body = await req.json();
    if (body.summary) summary = body.summary;
  } catch { /* no body — that's fine */ }

  await notifyDeploy(summary);
  return NextResponse.json({ ok: true });
}

// Called on first GET after deploy to announce "system online"
// Vercel's zero-downtime means this fires on the first real request
let announced = false;
export async function GET() {
  if (!announced) {
    announced = true;
    await notifyDeploy("Omni AI platform is live — all systems operational");
  }
  return NextResponse.json({ ok: true, announced });
}
