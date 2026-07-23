import { Pool } from "pg";
import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/validation";
import { verifySfdUnsubscribeToken } from "@/lib/sfdempire-unsubscribe-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var __sfdUnsubscribePgPool: Pool | undefined;
}

function databasePool(): Pool {
  const connectionString =
    process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!connectionString) throw new Error("database_not_configured");
  const parsed = new URL(connectionString);
  parsed.searchParams.delete("sslmode");
  if (!global.__sfdUnsubscribePgPool) {
    global.__sfdUnsubscribePgPool = new Pool({
      connectionString: parsed.toString(),
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 12_000,
      query_timeout: 20_000,
      statement_timeout: 15_000,
      ssl:
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
          ? undefined
          : { rejectUnauthorized: false },
    });
  }
  return global.__sfdUnsubscribePgPool;
}

function page(
  title: string,
  message: string,
  status: number,
): NextResponse {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex">
    <title>${title}</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f5efe4;font-family:Arial,sans-serif;padding:24px;box-sizing:border-box}
      main{width:min(520px,100%);border:1px solid #4e452f;padding:40px;box-sizing:border-box;background:#0b0a08}
      p{color:#aaa297;line-height:1.65}a{color:#d5ad43}
    </style>
  </head>
  <body><main><h1>${title}</h1><p>${message}</p><p><a href="https://sfdempire.com">Return to SFD Empire</a></p></main></body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function confirmationPage(token: string): NextResponse {
  const action = `/api/inbound/sfdempire/forms/unsubscribe?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Confirm unsubscribe</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f5efe4;font-family:Arial,sans-serif;padding:24px;box-sizing:border-box}
      main{width:min(520px,100%);border:1px solid #4e452f;padding:40px;box-sizing:border-box;background:#0b0a08}p{color:#aaa297;line-height:1.65}
      button{border:0;background:#d5ad43;color:#050505;padding:15px 22px;font-weight:800;letter-spacing:1.5px;cursor:pointer}a{color:#d5ad43}
    </style>
  </head>
  <body><main><h1>Confirm unsubscribe</h1><p>Stop SFD Empire newsletter and launch-update email to this address?</p><form method="post" action="${action}"><button type="submit">UNSUBSCRIBE</button></form><p><a href="https://sfdempire.com">Keep my subscription</a></p></main></body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function verifiedEmail(request: Request):
  | { ok: true; email: string; token: string }
  | { ok: false; response: NextResponse } {
  const token = new URL(request.url).searchParams.get("token") || "";
  const verified = verifySfdUnsubscribeToken(token);
  if (!verified.ok || !isValidEmail(verified.email)) {
    return {
      ok: false,
      response: page(
        "Unsubscribe link could not be verified",
        "This link is invalid or expired. Contact SFD Empire if you still need help.",
        400,
      ),
    };
  }
  return { ok: true, email: verified.email, token };
}

async function unsubscribe(request: Request): Promise<NextResponse> {
  const verified = verifiedEmail(request);
  if (!verified.ok) return verified.response;
  try {
    const result = await databasePool().query<{ ok: boolean }>(
      "select public.unsubscribe_sfdempire_newsletter($1) as ok",
      [verified.email],
    );
    if (result.rows[0]?.ok !== true) {
      throw new Error("unsubscribe_not_persisted");
    }
  } catch (error) {
    console.error(
      "[sfdempire/unsubscribe] persistence failed",
      error instanceof Error ? error.message : "unknown",
    );
    return page(
      "Unsubscribe could not be completed",
      "We could not save that change. Please try again shortly.",
      503,
    );
  }

  const acceptsHtml = (request.headers.get("accept") || "").includes(
    "text/html",
  );
  if (!acceptsHtml) {
    return NextResponse.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return page(
    "You have been unsubscribed",
    "SFD Empire will no longer send newsletter or launch-update email to this address.",
    200,
  );
}

export async function GET(request: Request) {
  const verified = verifiedEmail(request);
  return verified.ok ? confirmationPage(verified.token) : verified.response;
}

export async function POST(request: Request) {
  return unsubscribe(request);
}
