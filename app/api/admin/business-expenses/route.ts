import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Same allow-list as /api/admin/paypal-finance. Finance is a sensitive
// surface — only the two designated finance admins may read or mutate.
const FINANCE_ALLOWLIST = (
  process.env.PAYPAL_FINANCE_ADMINS ||
  "sitanim8@gmail.com,benjones@omnileadsllc.com"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function decodeOmniToken(token: string): { sub?: string; exp?: number } | null {
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
    return { error: NextResponse.json({ error: "Unauthorized — missing token" }, { status: 401 }) };
  }
  const payload = decodeOmniToken(token);
  if (!payload?.sub) {
    return { error: NextResponse.json({ error: "Unauthorized — invalid token" }, { status: 401 }) };
  }
  if (typeof payload.exp === "number" && payload.exp < Date.now()) {
    return { error: NextResponse.json({ error: "Unauthorized — token expired" }, { status: 401 }) };
  }

  const sb = createAdminClient();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id,email,role,is_admin,tier_label")
    .eq("id", payload.sub)
    .single();
  if (error || !profile) {
    return { error: NextResponse.json({ error: "Unauthorized — profile not found" }, { status: 401 }) };
  }

  const email = (profile.email || "").toLowerCase();
  const isAdmin =
    profile.is_admin === true || profile.role === "admin" || profile.tier_label === "admin";
  if (!isAdmin || !email || !FINANCE_ALLOWLIST.includes(email)) {
    return { error: NextResponse.json({ error: "Forbidden — finance data restricted" }, { status: 403 }) };
  }
  return { email, profileId: profile.id };
}

type Expense = {
  id: string;
  label: string;
  category: "subscription" | "ads" | "domain" | "tool" | "infra" | "other";
  amount_usd: string | number;
  cadence: "monthly" | "annual" | "one_time";
  notes: string | null;
  started_on: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// GET — list all expenses + aggregated totals (monthly burn, one-time total).
export async function GET(request: Request) {
  const auth = await requireFinanceAdmin(request);
  if ("error" in auth) return auth.error;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("business_expenses")
    .select("id,label,category,amount_usd,cadence,notes,started_on,active,created_at,updated_at")
    .order("category", { ascending: true })
    .order("amount_usd", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as Expense[];

  // Monthly burn = sum of active monthly subscriptions + (active annual / 12).
  // One-time total = sum of active one-time entries (ad spend, domains, etc.)
  let monthlyBurn = 0;
  let oneTimeTotal = 0;
  for (const r of rows) {
    if (!r.active) continue;
    const amt = Number(r.amount_usd) || 0;
    if (r.cadence === "monthly") monthlyBurn += amt;
    else if (r.cadence === "annual") monthlyBurn += amt / 12;
    else oneTimeTotal += amt;
  }

  const res = NextResponse.json({
    expenses: rows.map((r) => ({ ...r, amount_usd: Number(r.amount_usd) || 0 })),
    summary: {
      monthly_burn: Math.round(monthlyBurn * 100) / 100,
      annualized_burn: Math.round(monthlyBurn * 12 * 100) / 100,
      one_time_total: Math.round(oneTimeTotal * 100) / 100,
      active_count: rows.filter((r) => r.active).length,
      total_count: rows.length,
    },
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

// POST — add a new expense (future UX: add button in the Finance tab).
export async function POST(request: Request) {
  const auth = await requireFinanceAdmin(request);
  if ("error" in auth) return auth.error;

  let body: Partial<Expense>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = (body.label || "").toString().trim();
  const category = (body.category || "other").toString();
  const amount_usd = Number(body.amount_usd);
  const cadence = (body.cadence || "one_time").toString();

  if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });
  if (!Number.isFinite(amount_usd) || amount_usd < 0) {
    return NextResponse.json({ error: "amount_usd must be a non-negative number" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("business_expenses")
    .insert({
      label,
      category,
      amount_usd,
      cadence,
      notes: body.notes ?? null,
      started_on: body.started_on ?? null,
      active: body.active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ expense: data }, { status: 201 });
}
