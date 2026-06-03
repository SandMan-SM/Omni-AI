import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sanitizeText } from "@/lib/validation";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { authenticateLocalLogin, warmPostgresConnection } from "@/lib/server/direct-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 10;

export async function GET() {
  try {
    await warmPostgresConnection();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, warming: true });
  }
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(`auth-login:${ip}`, 20, 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
  }

  const username = sanitizeText(
    typeof body.username === "string" ? body.username : "",
    100,
  );
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 },
    );
  }

  try {
    const payload = await Promise.race([
      authenticateLocalLogin(username, password),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Login timed out")), 8_000),
      ),
    ]);
    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    if (message === "Wrong password" || message === "User not found") {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    console.error("[auth/login] local login failed:", error);
    return NextResponse.json(
      { error: "Login is temporarily unavailable" },
      { status: 503 },
    );
  }
}
