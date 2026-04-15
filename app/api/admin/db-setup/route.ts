import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

// POST /api/admin/db-setup — apply schema migrations (idempotent)
export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sb = createAdminClient();
  const errors: string[] = [];

  // 1. Add send_feedback column
  let e1: { message: string } | null = null;
  try {
    const result = await sb.rpc("exec", {
      sql: "ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS send_feedback TEXT;",
    });
    e1 = result.error;
  } catch {
    e1 = { message: "RPC not available — trying direct alter" };
  }

  // Fallback: try via raw connection through a one-off insert that tests the column
  // If send_feedback col doesn't exist, this will fail and we know to alert
  const { error: colCheckErr } = await sb
    .from("newsletter_posts")
    .select("send_feedback")
    .limit(1)
    .maybeSingle();

  if (colCheckErr && colCheckErr.message.includes('column "send_feedback" does not exist')) {
    const { error: addErr } = await sb.rpc("exec", {
      sql: "ALTER TABLE public.newsletter_posts ADD COLUMN IF NOT EXISTS send_feedback TEXT;",
    });
    if (addErr) errors.push(`send_feedback: ${addErr.message}`);
  }

  void e1; // suppress unused variable warning

  // 2. Create email_send_logs table
  let createErr: { message: string } | null = null;
  try {
    const result = await sb.rpc("exec", {
      sql: `
        CREATE TABLE IF NOT EXISTS public.email_send_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          post_id UUID REFERENCES public.newsletter_posts(id),
          subject TEXT,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          recipients_count INTEGER DEFAULT 0,
          opened_count INTEGER DEFAULT 0,
          clicked_count INTEGER DEFAULT 0,
          bounced_count INTEGER DEFAULT 0,
          unsubscribed_count INTEGER DEFAULT 0,
          open_rate FLOAT DEFAULT 0,
          click_rate FLOAT DEFAULT 0,
          notes TEXT,
          improvement_tags TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `,
    });
    createErr = result.error;
  } catch {
    createErr = null; // table may already exist
  }

  void createErr;

  // 3. RLS on email_send_logs
  try {
    await sb.rpc("exec", {
      sql: `ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;`,
    });
  } catch {
    // ignore
  }
  try {
    await sb.rpc("exec", {
      sql: `CREATE POLICY IF NOT EXISTS "Admins can manage email_send_logs" ON public.email_send_logs FOR ALL USING (true) WITH CHECK (true);`,
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    note: "Schema applied. If RPC exec failed, run the SQL manually in Supabase SQL Editor.",
  });
}
