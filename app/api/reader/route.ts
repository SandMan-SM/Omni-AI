import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import {
  enroll,
  reader,
  ReaderError,
  requestCode,
  signOut,
  verifyCode,
} from "@/lib/server/editorial-reader";

export const dynamic = "force-dynamic";
const cookie = "interlinked_reader";
const readerHosts = new Set([
  "omnileadsagi.com",
  "www.omnileadsagi.com",
  "interlinked.news",
]);
const json = (value: object, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const token = (req: NextRequest) => req.cookies.get(cookie)?.value || "";
function failure(e: unknown) {
  if (e instanceof ReaderError) return json({ error: e.message }, e.status);
  console.error(
    "Editorial reader service unavailable",
    e instanceof Error ? e.name : "error",
  );
  return json(
    { error: "We could not finish that step. Please try again." },
    503,
  );
}
export async function GET(req: NextRequest) {
  try {
    const session = await reader(token(req));
    return json({
      step: session ? (session.complete ? "ready" : "profile") : "email",
      premium: session?.premium === true,
    });
  } catch (e) {
    return failure(e);
  }
}
function validOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  if (readerHosts.has(host)) return origin === `https://${host}`;
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      origin === url.origin &&
      url.host === host
    );
  } catch {
    return false;
  }
}
export async function POST(req: NextRequest) {
  if (
    !validOrigin(req) ||
    !req.headers.get("content-type")?.startsWith("application/json")
  )
    return json({ error: "Open the reader page to continue." }, 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return json({ error: "Invalid request." }, 400);
  const field = (k: string) =>
    typeof body[k] === "string" ? body[k].trim() : "";
  try {
    switch (body.action) {
      case "request":
        if (field("website"))
          return json({ step: "code", challenge: crypto.randomUUID() });
        return json({
          step: "code",
          challenge: await requestCode(
            field("email").toLowerCase(),
            getClientIp(req.headers),
          ),
        });
      case "verify": {
        const value = await verifyCode(field("challenge"), field("code"));
        const session = await reader(value);
        const res = json({ step: session?.complete ? "ready" : "profile" });
        res.cookies.set(cookie, value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 86400,
        });
        return res;
      }
      case "profile": {
        const session = await reader(token(req));
        if (!session) return json({ error: "Sign in again to continue." }, 401);
        if (body.consent !== true)
          return json(
            { error: "Confirm your newsletter subscription to continue." },
            400,
          );
        await enroll(
          session.email,
          field("fullName"),
          field("phone"),
          body.source === "omnios" ? "omnios" : "interlinked",
        );
        return json({ step: "ready" });
      }
      case "logout": {
        await signOut(token(req));
        const res = json({ step: "email" });
        res.cookies.delete(cookie);
        return res;
      }
      default:
        return json({ error: "Unknown request." }, 400);
    }
  } catch (e) {
    return failure(e);
  }
}
