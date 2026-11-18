import type { NextRequest } from "next/server";
import { editorialUnsubscribeId } from "@/lib/server/editorial-unsubscribe";
import { stopReaderMail } from "@/lib/server/editorial-reader";

export const dynamic = "force-dynamic";
function page(title: string, body: string, status = 200) {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' +
      title +
      " | Interlinked</title><main><h1>" +
      title +
      "</h1>" +
      body +
      "</main></html>",
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
}
function identity(req: NextRequest) {
  return editorialUnsubscribeId(req.nextUrl.searchParams.get("token") || "");
}
export function GET(req: NextRequest) {
  if (!identity(req))
    return page(
      "Invalid link",
      "<p>Open the unsubscribe link from your Interlinked email.</p>",
      400,
    );
  return page(
    "Unsubscribe from Interlinked",
    '<p>Stop the daily newsletter for this reader account.</p><form method="post"><button>Unsubscribe</button></form>',
  );
}
export async function POST(req: NextRequest) {
  const id = identity(req);
  if (!id)
    return page(
      "Invalid link",
      "<p>Use the link from your latest email.</p>",
      400,
    );
  try {
    await stopReaderMail(id);
    return page(
      "You’re unsubscribed",
      "<p>You can still sign in and read the archive.</p>",
    );
  } catch {
    return page(
      "Please try again",
      "<p>Your preference could not be saved yet.</p>",
      503,
    );
  }
}
