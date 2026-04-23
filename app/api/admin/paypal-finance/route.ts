import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverErrorResponse } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// Extra belt-and-braces: only these two admins may view finance data.
// Read from env in production for easy rotation; fall back to hardcoded pair.
const FINANCE_ALLOWLIST = (
  process.env.PAYPAL_FINANCE_ADMINS ||
  "sitanim8@gmail.com,benjones@omnileadsllc.com"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function decodeOmniToken(token: string): { sub?: string; exp?: number } | null {
  // Tokens minted by the auth-login edge function are base64(JSON({sub, exp, ...})),
  // not Supabase JWTs. Decode directly and treat the DB as the source of truth.
  try {
    const json = Buffer.from(token, "base64").toString("utf8");
    const payload = JSON.parse(json);
    if (typeof payload !== "object" || !payload) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireFinanceAdmin(
  request: Request,
): Promise<{ email: string; profileId: string } | { error: NextResponse }> {
  const authz = request.headers.get("authorization") || "";
  const token = authz.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized — missing token" }, { status: 401 }),
    };
  }

  const payload = decodeOmniToken(token);
  if (!payload?.sub) {
    return {
      error: NextResponse.json({ error: "Unauthorized — invalid token" }, { status: 401 }),
    };
  }
  if (typeof payload.exp === "number" && payload.exp < Date.now()) {
    return {
      error: NextResponse.json({ error: "Unauthorized — token expired" }, { status: 401 }),
    };
  }

  // Source of truth: profiles table. Token is only used to identify the profile id.
  const sb = createAdminClient();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id,email,role,is_admin,tier_label")
    .eq("id", payload.sub)
    .single();
  if (error || !profile) {
    return {
      error: NextResponse.json({ error: "Unauthorized — profile not found" }, { status: 401 }),
    };
  }

  const email = (profile.email || "").toLowerCase();
  const isAdmin =
    profile.is_admin === true ||
    profile.role === "admin" ||
    profile.tier_label === "admin";

  if (!isAdmin || !email || !FINANCE_ALLOWLIST.includes(email)) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — finance data restricted" },
        { status: 403 },
      ),
    };
  }

  return { email, profileId: profile.id };
}

type Txn = {
  paypal_txn_id: string;
  transaction_amount: number | null;
  fee_amount: number | null;
  net_amount: number | null;
  transaction_currency: string | null;
  transaction_status: string | null;
  transaction_event_code: string | null;
  payer_email: string | null;
  payer_name: string | null;
  transaction_initiation_date: string | null;
};

function classify(code: string | null): "payment" | "refund" | "withdrawal" | "other" {
  const c = (code || "").toUpperCase();
  if (c.startsWith("T00")) return "payment";
  if (c.startsWith("T11") || c.startsWith("T15") || c.startsWith("T19")) return "refund";
  if (c.startsWith("T04")) return "withdrawal";
  return "other";
}

export async function GET(request: Request) {
  const auth = await requireFinanceAdmin(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, Math.min(3650, Number(searchParams.get("days") || "365")));

  const sb = createAdminClient();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const [txnRes, runRes] = await Promise.all([
    sb
      .from("paypal_transactions")
      .select(
        "paypal_txn_id,transaction_amount,fee_amount,net_amount,transaction_currency,transaction_status,transaction_event_code,payer_email,payer_name,transaction_initiation_date"
      )
      .gte("transaction_initiation_date", cutoff)
      .order("transaction_initiation_date", { ascending: false })
      .limit(500),
    sb
      .from("paypal_sync_runs")
      .select("started_at,finished_at,status,fetched_count,upserted_count,error_message")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  if (txnRes.error) {
    return serverErrorResponse("admin/paypal-finance.GET", txnRes.error);
  }

  const txns = (txnRes.data || []) as Txn[];

  let gross = 0;
  let fees = 0;
  let refunds = 0;
  let withdrawals = 0;
  let paymentCount = 0;
  const byMonth: Record<string, number> = {};
  const byPayer: Record<string, { name: string | null; email: string; total: number; count: number }> = {};

  for (const t of txns) {
    const status = (t.transaction_status || "").toUpperCase();
    if (status !== "S" && status !== "COMPLETED") continue;

    const kind = classify(t.transaction_event_code);
    const amt = Number(t.transaction_amount || 0);
    const fee = Number(t.fee_amount || 0);

    if (kind === "payment" && amt > 0) {
      gross += amt;
      fees += fee < 0 ? -fee : fee;
      paymentCount++;
      if (t.transaction_initiation_date) {
        const key = t.transaction_initiation_date.slice(0, 7);
        byMonth[key] = (byMonth[key] || 0) + amt;
      }
      if (t.payer_email) {
        const k = t.payer_email.toLowerCase();
        byPayer[k] = byPayer[k] || { name: t.payer_name, email: t.payer_email, total: 0, count: 0 };
        byPayer[k].total += amt;
        byPayer[k].count += 1;
      }
    } else if (kind === "refund" && amt < 0) {
      refunds += -amt;
    } else if (kind === "withdrawal") {
      withdrawals += amt < 0 ? -amt : amt;
    }
  }

  const net = gross - refunds - fees;

  const monthly = Object.entries(byMonth)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

  const topPayers = Object.values(byPayer)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((p) => ({ ...p, total: Math.round(p.total * 100) / 100 }));

  const lastSync = runRes.data?.[0] || null;

  const res = NextResponse.json({
    window_days: days,
    summary: {
      gross_revenue: Math.round(gross * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      refunds: Math.round(refunds * 100) / 100,
      net_revenue: Math.round(net * 100) / 100,
      bank_withdrawals: Math.round(withdrawals * 100) / 100,
      payment_count: paymentCount,
    },
    monthly,
    top_payers: topPayers,
    transactions: txns.map((t) => ({
      ...t,
      kind: classify(t.transaction_event_code),
    })),
    last_sync: lastSync,
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
